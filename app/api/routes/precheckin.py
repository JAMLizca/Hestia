"""
Pre-check-in: el huésped completa su registro desde un enlace antes de llegar y recepción lo valida.

Dos grupos de rutas:
- /reservas/{id}/precheckin (con sesión): recepción genera el enlace, ve lo que envió el huésped y
  lo valida, lo que aplica esos datos al registro del huésped.
- /publico/precheckin/{token} (sin sesión): lo que abre el huésped. El token es el único secreto,
  por eso las rutas públicas tienen límite de peticiones y no revelan nada sobre enlaces inválidos.
"""
import secrets
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, liberar_pendientes_vencidas
from app.core.limites import limitar_publico, registrar_fallo
from app.models.configuracion import CONFIG_ID, ConfiguracionHotel
from app.models.huesped import Huesped
from app.models.precheckin import PreCheckin
from app.models.reserva import Reserva
from app.models.usuario import Usuario
from app.schemas.configuracion import VALORES_POR_DEFECTO
from app.schemas.precheckin import (
    PreCheckinEnvio,
    PreCheckinOut,
    PreCheckinPublico,
    ValidarPreCheckin,
)

# Estados de la reserva en los que todavía tiene sentido pedir el registro previo.
ESTADOS_ADMITEN = ("pendiente", "confirmada")

router = APIRouter(
    prefix="/reservas/{reserva_id}/precheckin",
    tags=["Pre-check-in"],
    dependencies=[Depends(get_current_user)],
)

publico = APIRouter(
    prefix="/publico/precheckin",
    tags=["Pre-check-in (público)"],
    dependencies=[Depends(limitar_publico), Depends(liberar_pendientes_vencidas)],
)


def _enlace(token: str) -> str:
    return f"/pre-checkin/{token}"


def _reserva_o_404(db: Session, reserva_id: int) -> Reserva:
    reserva = db.get(Reserva, reserva_id)
    if not reserva:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No existe una reserva con id {reserva_id}")
    return reserva


def _datos_huesped(h: Huesped) -> dict:
    return {
        "id": h.id,
        "tipo_documento": h.tipo_documento,
        "documento_identidad": h.documento_identidad,
        "nombres": h.nombres,
        "apellidos": h.apellidos,
        "nacionalidad": h.nacionalidad,
        "fecha_nacimiento": h.fecha_nacimiento.isoformat() if h.fecha_nacimiento else None,
        "telefono": h.telefono,
        "email": h.email,
    }


def _salida(pc: PreCheckin) -> PreCheckinOut:
    return PreCheckinOut(
        reserva_id=pc.reserva_id,
        token=pc.token,
        enlace=_enlace(pc.token),
        estado=pc.estado,
        datos=pc.datos,
        fecha_creacion=pc.fecha_creacion,
        fecha_completado=pc.fecha_completado,
        fecha_validacion=pc.fecha_validacion,
        huesped=_datos_huesped(pc.reserva.huesped),
    )


# ── Recepción ───────────────────────────────────────────────────────────────

@router.get("/", response_model=PreCheckinOut | None, summary="Pre-check-in de la reserva (null si aún no se creó el enlace)")
def obtener_precheckin(reserva_id: int, db: Session = Depends(get_db)):
    reserva = _reserva_o_404(db, reserva_id)
    return _salida(reserva.precheckin) if reserva.precheckin else None


@router.post(
    "/",
    response_model=PreCheckinOut,
    status_code=status.HTTP_201_CREATED,
    summary="Crea el enlace de pre-check-in o genera uno nuevo (el anterior deja de funcionar)",
)
def crear_precheckin(reserva_id: int, db: Session = Depends(get_db)):
    reserva = _reserva_o_404(db, reserva_id)
    if reserva.estado not in ESTADOS_ADMITEN:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Solo se puede pedir el pre-check-in de una reserva pendiente o confirmada (actual: '{reserva.estado}')",
        )
    if reserva.fecha_checkin_prevista < date.today():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "La fecha de llegada ya pasó: registra al huésped en recepción")

    pc = reserva.precheckin
    if pc and pc.estado == "validado":
        raise HTTPException(status.HTTP_409_CONFLICT, "El pre-check-in de esta reserva ya fue validado")
    if pc is None:
        pc = PreCheckin(reserva_id=reserva.id, estado="enviado")
        db.add(pc)
    pc.token = secrets.token_urlsafe(24)
    db.commit()
    db.refresh(pc)
    return _salida(pc)


@router.post(
    "/validar",
    response_model=PreCheckinOut,
    summary="Valida lo que envió el huésped y lo aplica a su registro",
)
def validar_precheckin(
    reserva_id: int,
    opciones: ValidarPreCheckin | None = None,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
):
    reserva = _reserva_o_404(db, reserva_id)
    pc = reserva.precheckin
    if pc is None or pc.estado != "completado":
        estado = pc.estado if pc else "sin crear"
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Solo se puede validar un pre-check-in completado por el huésped (actual: '{estado}')",
        )
    opciones = opciones or ValidarPreCheckin()
    declarado = pc.datos["titular"]
    huesped = reserva.huesped

    documento = declarado["documento_identidad"].strip()
    if documento.upper() != huesped.documento_identidad.upper():
        if not opciones.actualizar_documento:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"El documento declarado ({documento}) no coincide con el registrado ({huesped.documento_identidad}). "
                "Confírmalo con el huésped y repite indicando que se actualice el documento.",
            )
        otro = db.query(Huesped).filter(Huesped.documento_identidad == documento, Huesped.id != huesped.id).first()
        if otro:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"Ya existe otro huésped con el documento '{documento}' (id {otro.id}); no se puede reasignar",
            )
        huesped.documento_identidad = documento

    for campo in ("tipo_documento", "nombres", "apellidos", "nacionalidad", "telefono", "email"):
        setattr(huesped, campo, declarado[campo])
    huesped.fecha_nacimiento = date.fromisoformat(declarado["fecha_nacimiento"])

    pc.estado = "validado"
    pc.fecha_validacion = datetime.now(timezone.utc)
    pc.validado_por_id = usuario.id
    db.commit()
    db.refresh(pc)
    return _salida(pc)


# ── Huésped (sin sesión) ────────────────────────────────────────────────────

def _resolver(db: Session, token: str, request: Request) -> PreCheckin:
    pc = db.query(PreCheckin).filter(PreCheckin.token == token).first()
    if pc is None:
        registrar_fallo(request)
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Este enlace no es válido. Pídele uno nuevo al hotel.")
    reserva = pc.reserva
    if pc.estado != "validado" and (reserva.estado not in ESTADOS_ADMITEN or reserva.fecha_checkin_prevista < date.today()):
        raise HTTPException(
            status.HTTP_410_GONE,
            "Este enlace ya no está disponible porque la reserva cambió o la fecha de llegada ya pasó. "
            "Comunícate con el hotel.",
        )
    return pc


def _vista_publica(db: Session, pc: PreCheckin) -> PreCheckinPublico:
    reserva, huesped = pc.reserva, pc.reserva.huesped
    config = db.get(ConfiguracionHotel, CONFIG_ID)
    hotel = config.nombre if config else VALORES_POR_DEFECTO["nombre"]
    hora = config.hora_checkin if config else VALORES_POR_DEFECTO["hora_checkin"]
    editable = pc.estado != "validado"
    return PreCheckinPublico(
        hotel_nombre=hotel,
        hora_checkin=hora.strftime("%H:%M") if hasattr(hora, "strftime") else str(hora)[:5],
        codigo=reserva.codigo,
        fecha_checkin=reserva.fecha_checkin_prevista,
        fecha_checkout=reserva.fecha_checkout_prevista,
        noches=(reserva.fecha_checkout_prevista - reserva.fecha_checkin_prevista).days,
        num_huespedes=reserva.num_huespedes,
        estado=pc.estado,
        titular={
            "tipo_documento": huesped.tipo_documento,
            "nombres": huesped.nombres,
            "apellidos": huesped.apellidos,
            "nacionalidad": huesped.nacionalidad,
        },
        datos=pc.datos if pc.estado == "completado" else None,
        editable=editable,
    )


@publico.get("/{token}", response_model=PreCheckinPublico, summary="Datos de la reserva para el formulario del huésped")
def ver_publico(token: str, request: Request, db: Session = Depends(get_db)):
    return _vista_publica(db, _resolver(db, token, request))


@publico.put("/{token}", response_model=PreCheckinPublico, summary="El huésped envía (o corrige) su registro")
def enviar_publico(token: str, envio: PreCheckinEnvio, request: Request, db: Session = Depends(get_db)):
    pc = _resolver(db, token, request)
    if pc.estado == "validado":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "El hotel ya validó tu registro. Si necesitas cambiar algo, díselo en recepción.",
        )
    maximo = pc.reserva.num_huespedes - 1
    if len(envio.acompanantes) > maximo:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"La reserva es para {pc.reserva.num_huespedes} "
            f"{'persona' if pc.reserva.num_huespedes == 1 else 'personas'}: "
            f"puedes registrar hasta {maximo} {'acompañante' if maximo == 1 else 'acompañantes'}.",
        )
    pc.datos = envio.model_dump(mode="json")
    pc.estado = "completado"
    pc.fecha_completado = datetime.now(timezone.utc)
    db.commit()
    db.refresh(pc)
    return _vista_publica(db, pc)
