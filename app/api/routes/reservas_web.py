"""
Reservas en línea: lo que usa el huésped desde la página pública /reservar, sin iniciar sesión.

- Consultar disponibilidad por tipo de habitación (sin revelar números de habitación).
- Crear una reserva `pendiente` con canal `web`: el sistema asigna una habitación libre del tipo
  elegido y el hotel la confirma (o vence sola si no se confirma; ver app/core/vencimiento.py).
- Consultar y cancelar una reserva con el código y el documento del titular.

No hay pagos en línea: el cobro se acuerda con el hotel al confirmar. Todo está detrás del
interruptor `reservas_web_activas` de Configuración (apagado por defecto).
"""
import logging
import secrets
from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, liberar_pendientes_vencidas
from app.api.routes.precheckin import ESTADOS_ADMITEN
from app.api.routes.reservas import ESTADOS_QUE_BLOQUEAN, _generar_codigo
from app.core import wompi
from app.core.config import settings
from app.core.limites import limitar_creacion, limitar_publico, registrar_creacion, registrar_fallo
from app.core.security import hash_password
from app.models.configuracion import CONFIG_ID, ConfiguracionHotel
from app.models.habitacion import Habitacion
from app.models.huesped import Huesped
from app.models.pago import Pago
from app.models.precheckin import PreCheckin
from app.models.reserva import Reserva
from app.models.role import Role
from app.models.tipo_habitacion import TipoHabitacion
from app.models.usuario import Usuario
from app.schemas.configuracion import VALORES_POR_DEFECTO
from app.schemas.reserva_web import (
    MAX_DIAS_ANTICIPACION,
    MAX_NOCHES,
    ConsultaWeb,
    HotelPublico,
    PagoIniciado,
    ReservaWebCreate,
    ReservaWebOut,
    TipoDisponible,
    VerificarPago,
)

router = APIRouter(
    prefix="/publico",
    tags=["Reservas en línea (público)"],
    dependencies=[Depends(limitar_publico), Depends(liberar_pendientes_vencidas)],
)

EMAIL_USUARIO_WEB = "reservas-en-linea@hestia.co"
MAX_PENDIENTES_WEB_POR_HUESPED = 3
MAX_INTENTOS_PAGO = 10  # intentos de pago (filas en `pagos`) por reserva

log = logging.getLogger("hestia.reservas_web")


# ── Utilidades ──────────────────────────────────────────────────────────────

def _config(db: Session) -> dict:
    fila = db.get(ConfiguracionHotel, CONFIG_ID)
    c = {k: getattr(fila, k, v) if fila else v for k, v in VALORES_POR_DEFECTO.items()}
    for campo in ("hora_checkin", "hora_checkout"):
        c[campo] = c[campo].strftime("%H:%M") if hasattr(c[campo], "strftime") else str(c[campo])[:5]
    return c


def _pagos_activos(config: dict) -> bool:
    """Pagos en línea: el hotel fijó un anticipo, cobra en COP y el servidor tiene las llaves de Wompi."""
    return config["anticipo_porcentaje"] > 0 and config["moneda"] == wompi.MONEDA and settings.WOMPI_CONFIGURADO


def _pagado(reserva: Reserva) -> Decimal:
    return sum((p.monto for p in reserva.pagos if p.estado == "pagado"), Decimal("0"))


def _exigir_activas(config: dict) -> None:
    if not config["reservas_web_activas"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Las reservas en línea no están disponibles por ahora. Comunícate con el hotel.")


def _validar_fechas(checkin: date, checkout: date) -> int:
    hoy = date.today()
    if checkin < hoy:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "La fecha de llegada no puede ser pasada.")
    if checkout <= checkin:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "La fecha de salida debe ser posterior a la de llegada.")
    if checkin > hoy + timedelta(days=MAX_DIAS_ANTICIPACION):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Solo se puede reservar con hasta {MAX_DIAS_ANTICIPACION} días de anticipación.")
    noches = (checkout - checkin).days
    if noches > MAX_NOCHES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Para estadías de más de {MAX_NOCHES} noches comunícate con el hotel.")
    return noches


def _ocupadas(db: Session, checkin: date, checkout: date) -> set[int]:
    filas = (
        db.query(Reserva.habitacion_id)
        .filter(
            Reserva.estado.in_(ESTADOS_QUE_BLOQUEAN),
            Reserva.fecha_checkin_prevista < checkout,
            Reserva.fecha_checkout_prevista > checkin,
        )
        .distinct()
        .all()
    )
    return {f[0] for f in filas}


def _usuario_web(db: Session) -> Usuario:
    """Usuario inactivo (no puede iniciar sesión) al que se atribuyen las reservas hechas en línea."""
    usuario = db.query(Usuario).filter(Usuario.email == EMAIL_USUARIO_WEB).first()
    if usuario:
        return usuario
    rol = db.query(Role).filter(Role.nombre == "recepcionista").first() or db.query(Role).first()
    if rol is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "El sistema aún no está configurado. Comunícate con el hotel.")
    usuario = Usuario(nombre="Reservas en línea", email=EMAIL_USUARIO_WEB, password_hash=hash_password(secrets.token_urlsafe(32)), rol_id=rol.id, activo=False)
    db.add(usuario)
    db.flush()
    return usuario


def _salida(db: Session, reserva: Reserva, config: dict, con_enlace: bool = True) -> ReservaWebOut:
    noches = (reserva.fecha_checkout_prevista - reserva.fecha_checkin_prevista).days
    pc = reserva.precheckin
    enlace = None
    if con_enlace and pc and pc.estado != "validado" and reserva.estado in ESTADOS_ADMITEN:
        enlace = f"/pre-checkin/{pc.token}"
    puede_cancelar = reserva.estado in ("pendiente", "confirmada") and reserva.fecha_checkin_prevista >= date.today()
    pagado = _pagado(reserva)
    monto_anticipo = wompi.anticipo(reserva.precio_total, config["anticipo_porcentaje"]) if _pagos_activos(config) else None
    puede_pagar = bool(monto_anticipo) and reserva.estado == "pendiente" and pagado < monto_anticipo
    return ReservaWebOut(
        puede_pagar=puede_pagar,
        anticipo_monto=monto_anticipo,
        pagado=pagado,
        codigo=reserva.codigo,
        estado=reserva.estado,
        tipo_habitacion=reserva.habitacion.tipo_habitacion.nombre,
        fecha_checkin=reserva.fecha_checkin_prevista,
        fecha_checkout=reserva.fecha_checkout_prevista,
        noches=noches,
        num_huespedes=reserva.num_huespedes,
        precio_total=reserva.precio_total,
        moneda=config["moneda"],
        hora_checkin=config["hora_checkin"],
        horas_vencimiento=config["horas_vencimiento_pendiente"],
        puede_cancelar=puede_cancelar,
        motivo_cancelacion=reserva.motivo_cancelacion,
        precheckin_enlace=enlace,
        hotel_telefono=config["telefono"],
        hotel_email=config["email"],
    )


def _buscar(db: Session, datos: ConsultaWeb, request: Request) -> Reserva:
    """Código + documento del titular: si no coinciden, el mensaje es el mismo y cuenta como intento fallido."""
    reserva = db.query(Reserva).filter(Reserva.codigo == datos.codigo.strip().upper()).first()
    if reserva is None or reserva.huesped.documento_identidad.strip().upper() != datos.documento_identidad.strip().upper():
        registrar_fallo(request)
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No encontramos una reserva con esos datos. Revisa el código y el documento.")
    return reserva


# ── Rutas ───────────────────────────────────────────────────────────────────

@router.get("/hotel", response_model=HotelPublico, summary="Datos públicos del hotel y si acepta reservas en línea")
def datos_hotel(db: Session = Depends(get_db)):
    c = _config(db)
    return HotelPublico(
        nombre=c["nombre"], ciudad=c["ciudad"], pais=c["pais"], direccion=c["direccion"], telefono=c["telefono"], email=c["email"],
        hora_checkin=c["hora_checkin"], hora_checkout=c["hora_checkout"], moneda=c["moneda"],
        reservas_activas=bool(c["reservas_web_activas"]), horas_vencimiento=c["horas_vencimiento_pendiente"],
        pagos_activos=_pagos_activos(c), anticipo_porcentaje=c["anticipo_porcentaje"],
    )


@router.get("/disponibilidad", response_model=list[TipoDisponible], summary="Tipos de habitación disponibles en un rango de fechas")
def disponibilidad_publica(
    fecha_checkin: date = Query(...),
    fecha_checkout: date = Query(...),
    huespedes: int = Query(default=1, ge=1, le=10),
    db: Session = Depends(get_db),
):
    _exigir_activas(_config(db))
    noches = _validar_fechas(fecha_checkin, fecha_checkout)
    ocupadas = _ocupadas(db, fecha_checkin, fecha_checkout)
    libres: dict[int, int] = {}
    for h in db.query(Habitacion).filter(Habitacion.estado != "mantenimiento").all():
        if h.id not in ocupadas:
            libres[h.tipo_habitacion_id] = libres.get(h.tipo_habitacion_id, 0) + 1
    tipos = db.query(TipoHabitacion).filter(TipoHabitacion.id.in_(libres or [0]), TipoHabitacion.capacidad_maxima >= huespedes).order_by(TipoHabitacion.precio_base).all()
    return [
        TipoDisponible(
            tipo_habitacion_id=t.id, nombre=t.nombre, descripcion=t.descripcion, capacidad_maxima=t.capacidad_maxima, camas=t.camas,
            metros_cuadrados=t.metros_cuadrados, precio_noche=t.precio_base, noches=noches, precio_total=t.precio_base * noches, disponibles=libres[t.id],
        )
        for t in tipos
    ]


@router.post(
    "/reservas",
    response_model=ReservaWebOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(limitar_creacion)],
    summary="Crea una reserva pendiente desde la página pública",
)
def crear_reserva_web(datos: ReservaWebCreate, request: Request, db: Session = Depends(get_db)):
    config = _config(db)
    _exigir_activas(config)
    if datos.sitio_web:  # campo trampa: un humano nunca lo ve
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No se pudo procesar la solicitud.")
    noches = _validar_fechas(datos.fecha_checkin, datos.fecha_checkout)

    tipo = db.get(TipoHabitacion, datos.tipo_habitacion_id)
    if tipo is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "El tipo de habitación elegido no existe.")
    if datos.num_huespedes > tipo.capacidad_maxima:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Este tipo de habitación admite máximo {tipo.capacidad_maxima} huéspedes.")

    h = datos.huesped
    huesped = db.query(Huesped).filter(Huesped.documento_identidad == h.documento_identidad).first()
    nuevo_huesped = huesped is None
    notas = datos.notas
    if nuevo_huesped:
        huesped = Huesped(
            documento_identidad=h.documento_identidad, tipo_documento=h.tipo_documento, nombres=h.nombres, apellidos=h.apellidos,
            email=h.email, telefono=h.telefono, nacionalidad=h.nacionalidad,
        )
        db.add(huesped)
        db.flush()
    else:
        # Quien reserva no puede modificar un huésped que ya existe: sus datos de contacto van en las notas
        # para que recepción los vea y decida.
        pendientes = (
            db.query(Reserva)
            .filter(Reserva.huesped_id == huesped.id, Reserva.canal == "web", Reserva.estado == "pendiente")
            .count()
        )
        if pendientes >= MAX_PENDIENTES_WEB_POR_HUESPED:
            raise HTTPException(status.HTTP_409_CONFLICT, "Ya tienes varias reservas pendientes de confirmar. Comunícate con el hotel.")
        contacto = f"Contacto en línea: {h.nombres} {h.apellidos} · {h.email} · {h.telefono}"
        notas = f"{contacto}\n{notas}" if notas else contacto

    # Se bloquean las habitaciones del tipo para que dos reservas simultáneas no tomen la misma.
    habitaciones = (
        db.query(Habitacion)
        .filter(Habitacion.tipo_habitacion_id == tipo.id, Habitacion.estado != "mantenimiento")
        .order_by(Habitacion.id)
        .with_for_update()
        .all()
    )
    ocupadas = _ocupadas(db, datos.fecha_checkin, datos.fecha_checkout)
    libre = next((x for x in habitaciones if x.id not in ocupadas), None)
    if libre is None:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya no hay habitaciones disponibles de ese tipo en esas fechas. Prueba con otras fechas.")

    reserva = Reserva(
        huesped_id=huesped.id,
        habitacion_id=libre.id,
        usuario_id=_usuario_web(db).id,
        fecha_checkin_prevista=datos.fecha_checkin,
        fecha_checkout_prevista=datos.fecha_checkout,
        num_huespedes=datos.num_huespedes,
        estado="pendiente",
        precio_total=tipo.precio_base * noches,
        codigo=_generar_codigo(db),
        canal="web",
        notas=notas[:500] if notas else None,
    )
    db.add(reserva)
    db.flush()
    # Con un huésped nuevo se entrega de una vez el enlace para completar el registro. Si el documento ya
    # existía no se hace: el formulario precargaría nombres de alguien que solo se conoce por su documento.
    if nuevo_huesped:
        db.add(PreCheckin(reserva_id=reserva.id, estado="enviado", token=secrets.token_urlsafe(24)))
    db.commit()
    registrar_creacion(request)
    db.refresh(reserva)
    return _salida(db, reserva, config)


@router.post("/reservas/consultar", response_model=ReservaWebOut, summary="Consulta una reserva con su código y el documento del titular")
def consultar_reserva_web(datos: ConsultaWeb, request: Request, db: Session = Depends(get_db)):
    return _salida(db, _buscar(db, datos, request), _config(db))


@router.post("/reservas/cancelar", response_model=ReservaWebOut, summary="El huésped cancela su reserva pendiente o confirmada")
def cancelar_reserva_web(datos: ConsultaWeb, request: Request, db: Session = Depends(get_db)):
    reserva = _buscar(db, datos, request)
    if reserva.estado not in ("pendiente", "confirmada") or reserva.fecha_checkin_prevista < date.today():
        raise HTTPException(status.HTTP_409_CONFLICT, f"Esta reserva está en estado '{reserva.estado}' y ya no se puede cancelar en línea. Comunícate con el hotel.")
    if any(p.estado == "pagado" for p in reserva.pagos):
        raise HTTPException(status.HTTP_409_CONFLICT, "Esta reserva tiene pagos registrados: comunícate con el hotel para cancelarla.")
    reserva.estado = "cancelada"
    reserva.motivo_cancelacion = "Cancelada por el huésped (en línea)"
    for p in reserva.pagos:
        if p.estado == "pendiente":  # si el huésped igual completa ese pago, aplicar_transaccion lo marca para reembolso
            p.estado = "anulado"
    db.commit()
    db.refresh(reserva)
    return _salida(db, reserva, _config(db))


@router.post("/reservas/pagar", response_model=PagoIniciado, summary="Inicia el pago del anticipo en Wompi y devuelve el enlace de pago")
def pagar_anticipo(datos: ConsultaWeb, request: Request, db: Session = Depends(get_db)):
    config = _config(db)
    if not _pagos_activos(config):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "El pago en línea no está disponible. Comunícate con el hotel para pagar tu anticipo.")
    reserva = _buscar(db, datos, request)
    if reserva.estado != "pendiente":
        raise HTTPException(status.HTTP_409_CONFLICT, f"Esta reserva está en estado '{reserva.estado}': ya no necesita pago de anticipo.")
    monto = wompi.anticipo(reserva.precio_total, config["anticipo_porcentaje"])
    if _pagado(reserva) >= monto:
        raise HTTPException(status.HTTP_409_CONFLICT, "El anticipo de esta reserva ya está pagado.")
    if len(reserva.pagos) >= MAX_INTENTOS_PAGO:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Hiciste demasiados intentos de pago. Comunícate con el hotel.")

    for p in reserva.pagos:  # un solo intento vigente a la vez
        if p.estado == "pendiente":
            p.estado = "anulado"
    referencia = wompi.nueva_referencia(reserva.codigo)
    db.add(Pago(reserva_id=reserva.id, monto=monto, metodo_pago="wompi", estado="pendiente", referencia=referencia))
    db.commit()
    h = reserva.huesped
    url = wompi.url_checkout(
        referencia=referencia, monto=monto, email=h.email, nombre=f"{h.nombres} {h.apellidos}".strip(),
        redirect_url=f"{settings.FRONTEND_URL.rstrip('/')}/reservar?pago={reserva.codigo}",
    )
    return PagoIniciado(url=url, referencia=referencia, monto=monto, moneda=wompi.MONEDA)


@router.post("/reservas/verificar-pago", response_model=ReservaWebOut, summary="Confirma un pago consultando la transacción a Wompi (respaldo del webhook)")
def verificar_pago(datos: VerificarPago, request: Request, db: Session = Depends(get_db)):
    reserva = _buscar(db, datos, request)
    if not settings.WOMPI_CONFIGURADO:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "El pago en línea no está disponible.")
    try:
        tx = wompi.consultar_transaccion(datos.transaccion_id)
    except wompi.WompiNoDisponible:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "No pudimos consultar el estado del pago. Inténtalo de nuevo en un momento.")
    # La transacción debe pertenecer a esta reserva: con otro código y documento no se confirma nada.
    if not any(p.referencia and p.referencia == tx.get("reference") for p in reserva.pagos):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ese pago no corresponde a esta reserva.")
    wompi.aplicar_transaccion(db, tx)
    db.refresh(reserva)
    return _salida(db, reserva, _config(db))
