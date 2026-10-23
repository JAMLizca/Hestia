"""
Reglas de negocio de las reservas: crear, editar y cambiar de estado.

Estados: pendiente → confirmada → checkin → checkout, más cancelada y no_show. Solo pendiente, confirmada y
checkin «bloquean» la habitación (ver app/services/ocupacion.py, que además lo garantiza en la base de datos).
"""
import secrets
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.errores import Conflicto, ErrorInterno, NoEncontrado, SolicitudInvalida
from app.models.habitacion import Habitacion
from app.models.huesped import Huesped
from app.models.reserva import Reserva
from app.models.usuario import Usuario
from app.schemas.reserva import ReservaCreate, ReservaUpdate
from app.services._comun import confirmar_cambios
from app.services.ocupacion import ESTADOS_QUE_BLOQUEAN
from app.services.temporada import temporada_para

# Sin 0/O ni 1/I/L: el código se dicta por teléfono y no debe confundirse.
_ALFABETO_CODIGO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

# Qué se puede cambiar según el estado de la reserva.
_CAMPOS_EDITABLES = {
    "pendiente": {"habitacion_id", "fecha_checkin_prevista", "fecha_checkout_prevista", "num_huespedes", "canal", "notas", "preferencias"},
    "confirmada": {"habitacion_id", "fecha_checkin_prevista", "fecha_checkout_prevista", "num_huespedes", "canal", "notas", "preferencias"},
    "checkin": {"fecha_checkout_prevista", "num_huespedes", "notas"},
}


def generar_codigo(db: Session) -> str:
    """Código corto y legible (HST-K7M4QX) que el huésped puede citar al llamar."""
    for _ in range(20):
        codigo = "HST-" + "".join(secrets.choice(_ALFABETO_CODIGO) for _ in range(6))
        if not db.query(Reserva.id).filter(Reserva.codigo == codigo).first():
            return codigo
    raise ErrorInterno("No se pudo generar un código de reserva único. Intenta de nuevo")


def obtener(db: Session, reserva_id: int) -> Reserva:
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise NoEncontrado(f"No existe una reserva con id {reserva_id}")
    return reserva


def listar(db: Session, *, huesped_id=None, habitacion_id=None, estado=None, codigo=None) -> list[Reserva]:
    query = db.query(Reserva)
    if huesped_id:
        query = query.filter(Reserva.huesped_id == huesped_id)
    if habitacion_id:
        query = query.filter(Reserva.habitacion_id == habitacion_id)
    if estado:
        query = query.filter(Reserva.estado == estado)
    if codigo:
        query = query.filter(Reserva.codigo == codigo.strip().upper())
    return query.all()


def hay_solapamiento(db: Session, habitacion_id: int, checkin: date, checkout: date, excluir_reserva_id: int | None = None) -> bool:
    query = db.query(Reserva).filter(
        Reserva.habitacion_id == habitacion_id,
        Reserva.estado.in_(ESTADOS_QUE_BLOQUEAN),
        Reserva.fecha_checkin_prevista < checkout,
        Reserva.fecha_checkout_prevista > checkin,
    )
    if excluir_reserva_id is not None:
        query = query.filter(Reserva.id != excluir_reserva_id)
    return db.query(query.exists()).scalar()


def crear(db: Session, datos: ReservaCreate, usuario: Usuario) -> Reserva:
    if not db.query(Huesped).filter(Huesped.id == datos.huesped_id).first():
        raise SolicitudInvalida(f"El huésped con id {datos.huesped_id} no existe")
    habitacion = db.query(Habitacion).filter(Habitacion.id == datos.habitacion_id).first()
    if not habitacion:
        raise SolicitudInvalida(f"La habitación con id {datos.habitacion_id} no existe")
    if habitacion.estado == "mantenimiento":
        raise SolicitudInvalida("La habitación está en mantenimiento y no se puede reservar")
    if datos.fecha_checkin_prevista < date.today():
        raise SolicitudInvalida("La fecha de check-in no puede ser pasada")
    capacidad = habitacion.tipo_habitacion.capacidad_maxima
    if datos.num_huespedes > capacidad:
        raise SolicitudInvalida(f"La habitación admite máximo {capacidad} huéspedes")
    if hay_solapamiento(db, datos.habitacion_id, datos.fecha_checkin_prevista, datos.fecha_checkout_prevista):
        raise Conflicto("La habitación ya está reservada en ese rango de fechas")

    noches = (datos.fecha_checkout_prevista - datos.fecha_checkin_prevista).days
    reserva = Reserva(
        huesped_id=datos.huesped_id,
        habitacion_id=datos.habitacion_id,
        usuario_id=usuario.id,
        fecha_checkin_prevista=datos.fecha_checkin_prevista,
        fecha_checkout_prevista=datos.fecha_checkout_prevista,
        num_huespedes=datos.num_huespedes,
        estado="pendiente",
        precio_total=habitacion.tipo_habitacion.precio_base * noches,
        codigo=generar_codigo(db),
        canal=datos.canal,
        notas=datos.notas,
        temporada=temporada_para(datos.fecha_checkin_prevista),
        preferencias=datos.preferencias.compactas() if datos.preferencias else None,
    )
    db.add(reserva)
    confirmar_cambios(db)
    db.refresh(reserva)
    return reserva


def editar(db: Session, reserva_id: int, datos: ReservaUpdate) -> Reserva:
    """
    Edición parcial. Mientras la reserva está pendiente o confirmada se puede cambiar casi todo; en check-in
    solo la salida prevista, el número de huéspedes y las notas; en cualquier otro estado, solo las notas.
    El precio se recalcula con la tarifa vigente.
    """
    reserva = obtener(db, reserva_id)
    cambios = datos.model_dump(exclude_unset=True)
    if "preferencias" in cambios:
        cambios["preferencias"] = datos.preferencias.compactas() if datos.preferencias else None
    # Un campo enviado con el mismo valor que ya tiene no es un cambio.
    cambios = {k: v for k, v in cambios.items() if v != getattr(reserva, k)}
    if not cambios:
        return reserva

    permitidos = _CAMPOS_EDITABLES.get(reserva.estado, {"notas"})
    no_permitidos = set(cambios) - permitidos
    if no_permitidos:
        if reserva.estado in _CAMPOS_EDITABLES:
            raise SolicitudInvalida(f"En una reserva '{reserva.estado}' no se puede cambiar: {', '.join(sorted(no_permitidos))}")
        raise SolicitudInvalida(f"Una reserva '{reserva.estado}' ya no se puede modificar; solo se pueden editar las notas")
    for campo in ("habitacion_id", "fecha_checkin_prevista", "fecha_checkout_prevista", "num_huespedes", "canal"):
        if campo in cambios and cambios[campo] is None:
            raise SolicitudInvalida(f"El campo '{campo}' no puede ser nulo")

    habitacion_id = cambios.get("habitacion_id", reserva.habitacion_id)
    checkin = cambios.get("fecha_checkin_prevista", reserva.fecha_checkin_prevista)
    checkout = cambios.get("fecha_checkout_prevista", reserva.fecha_checkout_prevista)
    num_huespedes = cambios.get("num_huespedes", reserva.num_huespedes)

    habitacion = db.query(Habitacion).filter(Habitacion.id == habitacion_id).first()
    if not habitacion:
        raise SolicitudInvalida(f"La habitación con id {habitacion_id} no existe")
    if "habitacion_id" in cambios and habitacion.estado == "mantenimiento":
        raise SolicitudInvalida("La habitación está en mantenimiento y no se puede reservar")
    if checkout <= checkin:
        raise SolicitudInvalida("La fecha de checkout debe ser posterior a la de checkin")
    if "fecha_checkin_prevista" in cambios and checkin < date.today():
        raise SolicitudInvalida("La fecha de check-in no puede ser pasada")
    capacidad = habitacion.tipo_habitacion.capacidad_maxima
    if num_huespedes > capacidad:
        raise SolicitudInvalida(f"La habitación admite máximo {capacidad} huéspedes")
    if reserva.estado in ESTADOS_QUE_BLOQUEAN and hay_solapamiento(db, habitacion_id, checkin, checkout, excluir_reserva_id=reserva.id):
        raise Conflicto("La habitación ya está reservada en ese rango de fechas")

    precio_total = reserva.precio_total
    if {"habitacion_id", "fecha_checkin_prevista", "fecha_checkout_prevista"} & set(cambios):
        precio_total = habitacion.tipo_habitacion.precio_base * (checkout - checkin).days
        pagado = sum((p.monto for p in reserva.pagos if p.estado == "pagado"), Decimal("0"))
        if precio_total < pagado:
            raise SolicitudInvalida(f"El nuevo total ({precio_total}) es menor que lo ya pagado ({pagado}). Gestiona primero ese pago")

    for campo, valor in cambios.items():
        setattr(reserva, campo, valor)
    reserva.precio_total = precio_total
    if "fecha_checkin_prevista" in cambios:
        reserva.temporada = temporada_para(checkin)
    confirmar_cambios(db)
    db.refresh(reserva)
    return reserva


def _guardar(db: Session, reserva: Reserva) -> Reserva:
    confirmar_cambios(db)
    db.refresh(reserva)
    return reserva


def confirmar(db: Session, reserva_id: int) -> Reserva:
    reserva = obtener(db, reserva_id)
    if reserva.estado != "pendiente":
        raise SolicitudInvalida(f"Solo se puede confirmar una reserva en estado 'pendiente' (actual: '{reserva.estado}')")
    reserva.estado = "confirmada"
    return _guardar(db, reserva)


def hacer_checkin(db: Session, reserva_id: int) -> Reserva:
    reserva = obtener(db, reserva_id)
    if reserva.estado != "confirmada":
        raise SolicitudInvalida(f"Solo se puede hacer check-in de una reserva 'confirmada' (actual: '{reserva.estado}')")
    # La habitación debe estar libre: evita dos huéspedes en la misma habitación y que se haga
    # check-in sobre una habitación sin limpiar o en mantenimiento.
    if reserva.habitacion.estado != "disponible":
        raise Conflicto(f"La habitación está '{reserva.habitacion.estado}' y no puede recibir el check-in")
    reserva.estado = "checkin"
    reserva.fecha_checkin_real = datetime.now(timezone.utc)
    reserva.habitacion.estado = "ocupada"
    return _guardar(db, reserva)


def hacer_checkout(db: Session, reserva_id: int) -> Reserva:
    reserva = obtener(db, reserva_id)
    if reserva.estado != "checkin":
        raise SolicitudInvalida(f"Solo se puede hacer check-out de una reserva en 'checkin' (actual: '{reserva.estado}')")
    reserva.estado = "checkout"
    reserva.fecha_checkout_real = datetime.now(timezone.utc)
    # Al hacer checkout, la habitación pasa a limpieza, no directo a disponible.
    reserva.habitacion.estado = "limpieza"
    return _guardar(db, reserva)


def cancelar(db: Session, reserva_id: int) -> Reserva:
    reserva = obtener(db, reserva_id)
    if reserva.estado not in ("pendiente", "confirmada"):
        raise SolicitudInvalida(f"No se puede cancelar una reserva en estado '{reserva.estado}'")
    reserva.estado = "cancelada"
    return _guardar(db, reserva)


def marcar_no_show(db: Session, reserva_id: int) -> Reserva:
    reserva = obtener(db, reserva_id)
    if reserva.estado not in ("pendiente", "confirmada"):
        raise SolicitudInvalida(f"Solo se puede marcar 'no se presentó' en una reserva pendiente o confirmada (actual: '{reserva.estado}')")
    if reserva.fecha_checkin_prevista > date.today():
        raise SolicitudInvalida("Aún no llega la fecha de check-in: si el huésped ya no vendrá, cancela la reserva")
    # Libera la habitación para las fechas restantes; los pagos recibidos se conservan.
    reserva.estado = "no_show"
    return _guardar(db, reserva)


def eliminar(db: Session, reserva_id: int) -> None:
    reserva = obtener(db, reserva_id)
    if reserva.pagos or reserva.reserva_servicios:
        raise SolicitudInvalida("No se puede eliminar: la reserva tiene pagos o servicios asociados. Cancélala en su lugar")
    if reserva.precheckin:
        db.delete(reserva.precheckin)
    db.delete(reserva)
    confirmar_cambios(db)
