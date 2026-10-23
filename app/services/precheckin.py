"""
Pre-check-in: el huésped completa su registro desde un enlace antes de llegar y recepción lo valida,
lo que aplica esos datos al registro del huésped.
"""
import secrets
from datetime import date, datetime, timezone

from sqlalchemy.orm import Session

from app.core.errores import Caducado, Conflicto, NoEncontrado, SolicitudInvalida
from app.models.configuracion import CONFIG_ID, ConfiguracionHotel
from app.models.huesped import Huesped
from app.models.precheckin import PreCheckin
from app.models.reserva import Reserva
from app.models.usuario import Usuario
from app.schemas.configuracion import VALORES_POR_DEFECTO
from app.schemas.precheckin import PreCheckinEnvio, PreCheckinOut, PreCheckinPublico, ValidarPreCheckin
from app.services._comun import confirmar_cambios

# Estados de la reserva en los que todavía tiene sentido pedir el registro previo.
ESTADOS_ADMITEN = ("pendiente", "confirmada")


def _enlace(token: str) -> str:
    return f"/pre-checkin/{token}"


def _reserva(db: Session, reserva_id: int) -> Reserva:
    reserva = db.get(Reserva, reserva_id)
    if not reserva:
        raise NoEncontrado(f"No existe una reserva con id {reserva_id}")
    return reserva


def _datos_huesped(h: Huesped) -> dict:
    return {
        "id": h.id, "tipo_documento": h.tipo_documento, "documento_identidad": h.documento_identidad,
        "nombres": h.nombres, "apellidos": h.apellidos, "nacionalidad": h.nacionalidad,
        "fecha_nacimiento": h.fecha_nacimiento.isoformat() if h.fecha_nacimiento else None,
        "telefono": h.telefono, "email": h.email,
    }


def salida(pc: PreCheckin) -> PreCheckinOut:
    return PreCheckinOut(
        reserva_id=pc.reserva_id, token=pc.token, enlace=_enlace(pc.token), estado=pc.estado, datos=pc.datos,
        fecha_creacion=pc.fecha_creacion, fecha_completado=pc.fecha_completado, fecha_validacion=pc.fecha_validacion,
        huesped=_datos_huesped(pc.reserva.huesped),
    )


# ── Recepción ───────────────────────────────────────────────────────────────

def obtener(db: Session, reserva_id: int) -> PreCheckinOut | None:
    reserva = _reserva(db, reserva_id)
    return salida(reserva.precheckin) if reserva.precheckin else None


def crear(db: Session, reserva_id: int) -> PreCheckinOut:
    reserva = _reserva(db, reserva_id)
    if reserva.estado not in ESTADOS_ADMITEN:
        raise SolicitudInvalida(f"Solo se puede pedir el pre-check-in de una reserva pendiente o confirmada (actual: '{reserva.estado}')")
    if reserva.fecha_checkin_prevista < date.today():
        raise SolicitudInvalida("La fecha de llegada ya pasó: registra al huésped en recepción")
    pc = reserva.precheckin
    if pc and pc.estado == "validado":
        raise Conflicto("El pre-check-in de esta reserva ya fue validado")
    if pc is None:
        pc = PreCheckin(reserva_id=reserva.id, estado="enviado")
        db.add(pc)
    pc.token = secrets.token_urlsafe(24)
    confirmar_cambios(db)
    db.refresh(pc)
    return salida(pc)


def validar(db: Session, reserva_id: int, opciones: ValidarPreCheckin | None, usuario: Usuario) -> PreCheckinOut:
    reserva = _reserva(db, reserva_id)
    pc = reserva.precheckin
    if pc is None or pc.estado != "completado":
        estado = pc.estado if pc else "sin crear"
        raise SolicitudInvalida(f"Solo se puede validar un pre-check-in completado por el huésped (actual: '{estado}')")
    opciones = opciones or ValidarPreCheckin()
    declarado = pc.datos["titular"]
    huesped = reserva.huesped

    documento = declarado["documento_identidad"].strip()
    if documento.upper() != huesped.documento_identidad.upper():
        if not opciones.actualizar_documento:
            raise Conflicto(
                f"El documento declarado ({documento}) no coincide con el registrado ({huesped.documento_identidad}). "
                "Confírmalo con el huésped y repite indicando que se actualice el documento."
            )
        otro = db.query(Huesped).filter(Huesped.documento_identidad == documento, Huesped.id != huesped.id).first()
        if otro:
            raise Conflicto(f"Ya existe otro huésped con el documento '{documento}' (id {otro.id}); no se puede reasignar")
        huesped.documento_identidad = documento

    for campo in ("tipo_documento", "nombres", "apellidos", "nacionalidad", "telefono", "email"):
        setattr(huesped, campo, declarado[campo])
    huesped.fecha_nacimiento = date.fromisoformat(declarado["fecha_nacimiento"])

    pc.estado = "validado"
    pc.fecha_validacion = datetime.now(timezone.utc)
    pc.validado_por_id = usuario.id
    confirmar_cambios(db)
    db.refresh(pc)
    return salida(pc)


# ── Huésped (sin sesión) ────────────────────────────────────────────────────

def resolver(db: Session, token: str) -> PreCheckin:
    """Lanza NoEncontrado si el enlace no existe (la ruta lo cuenta como intento fallido) o Caducado si ya no sirve."""
    pc = db.query(PreCheckin).filter(PreCheckin.token == token).first()
    if pc is None:
        raise NoEncontrado("Este enlace no es válido. Pídele uno nuevo al hotel.")
    reserva = pc.reserva
    if pc.estado != "validado" and (reserva.estado not in ESTADOS_ADMITEN or reserva.fecha_checkin_prevista < date.today()):
        raise Caducado(
            "Este enlace ya no está disponible porque la reserva cambió o la fecha de llegada ya pasó. Comunícate con el hotel."
        )
    return pc


def vista_publica(db: Session, pc: PreCheckin) -> PreCheckinPublico:
    reserva, huesped = pc.reserva, pc.reserva.huesped
    config = db.get(ConfiguracionHotel, CONFIG_ID)
    hotel = config.nombre if config else VALORES_POR_DEFECTO["nombre"]
    hora = config.hora_checkin if config else VALORES_POR_DEFECTO["hora_checkin"]
    return PreCheckinPublico(
        hotel_nombre=hotel,
        hora_checkin=hora.strftime("%H:%M") if hasattr(hora, "strftime") else str(hora)[:5],
        codigo=reserva.codigo,
        fecha_checkin=reserva.fecha_checkin_prevista,
        fecha_checkout=reserva.fecha_checkout_prevista,
        noches=(reserva.fecha_checkout_prevista - reserva.fecha_checkin_prevista).days,
        num_huespedes=reserva.num_huespedes,
        estado=pc.estado,
        titular={"tipo_documento": huesped.tipo_documento, "nombres": huesped.nombres, "apellidos": huesped.apellidos, "nacionalidad": huesped.nacionalidad},
        datos=pc.datos if pc.estado == "completado" else None,
        editable=pc.estado != "validado",
    )


def enviar(db: Session, pc: PreCheckin, envio: PreCheckinEnvio) -> PreCheckinPublico:
    if pc.estado == "validado":
        raise Conflicto("El hotel ya validó tu registro. Si necesitas cambiar algo, díselo en recepción.")
    maximo = pc.reserva.num_huespedes - 1
    if len(envio.acompanantes) > maximo:
        raise SolicitudInvalida(
            f"La reserva es para {pc.reserva.num_huespedes} {'persona' if pc.reserva.num_huespedes == 1 else 'personas'}: "
            f"puedes registrar hasta {maximo} {'acompañante' if maximo == 1 else 'acompañantes'}."
        )
    pc.datos = envio.model_dump(mode="json")
    pc.estado = "completado"
    pc.fecha_completado = datetime.now(timezone.utc)
    confirmar_cambios(db)
    db.refresh(pc)
    return vista_publica(db, pc)
