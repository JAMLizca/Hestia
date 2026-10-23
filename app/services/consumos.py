"""Servicios consumidos dentro de una reserva. El precio se congela al agregar."""
from sqlalchemy.orm import Session

from app.core.errores import Conflicto, NoEncontrado, SolicitudInvalida
from app.models.reserva import Reserva
from app.models.reserva_servicio import ReservaServicio
from app.models.servicio import Servicio
from app.schemas.reserva_servicio import ReservaServicioCreate, ReservaServicioUpdate
from app.services import facturacion
from app.services._comun import confirmar_cambios

ESTADOS_QUE_PERMITEN_MODIFICAR = ("pendiente", "confirmada", "checkin")

obtener_reserva = facturacion.obtener_reserva


def listar(db: Session, reserva_id: int) -> list[ReservaServicio]:
    obtener_reserva(db, reserva_id)
    return db.query(ReservaServicio).filter(ReservaServicio.reserva_id == reserva_id).order_by(ReservaServicio.id).all()


def _exigir_modificable(reserva: Reserva, verbo: str) -> None:
    if reserva.estado not in ESTADOS_QUE_PERMITEN_MODIFICAR:
        raise SolicitudInvalida(f"No se pueden {verbo} de una reserva en estado '{reserva.estado}'")


def agregar(db: Session, reserva_id: int, datos: ReservaServicioCreate) -> ReservaServicio:
    reserva = obtener_reserva(db, reserva_id)
    if reserva.estado not in ESTADOS_QUE_PERMITEN_MODIFICAR:
        raise SolicitudInvalida(f"No se pueden agregar servicios a una reserva en estado '{reserva.estado}'")
    servicio = db.query(Servicio).filter(Servicio.id == datos.servicio_id).first()
    if not servicio:
        raise SolicitudInvalida(f"El servicio con id {datos.servicio_id} no existe")
    nuevo = ReservaServicio(reserva_id=reserva_id, servicio_id=datos.servicio_id, cantidad=datos.cantidad, precio_unitario=servicio.precio)
    db.add(nuevo)
    confirmar_cambios(db)
    db.refresh(nuevo)
    return nuevo


def _obtener_item(db: Session, reserva_id: int, item_id: int) -> tuple[Reserva, ReservaServicio]:
    reserva = obtener_reserva(db, reserva_id)
    _exigir_modificable(reserva, "modificar los servicios")
    item = db.query(ReservaServicio).filter(ReservaServicio.id == item_id, ReservaServicio.reserva_id == reserva_id).first()
    if not item:
        raise NoEncontrado("No existe ese servicio dentro de la reserva")
    return reserva, item


def _exigir_que_no_quede_pagado_de_mas(reserva: Reserva, nuevo_costo_servicios) -> None:
    """Rebajar un consumo no puede dejar a la reserva con más dinero pagado que su nuevo total."""
    nuevo_total = reserva.precio_total + nuevo_costo_servicios
    pagado = facturacion.total_pagado(reserva)
    if pagado > nuevo_total:
        raise Conflicto(
            f"No se puede rebajar: la reserva ya tiene pagado {pagado} y su total quedaría en {nuevo_total}. "
            "Anula o corrige primero el pago."
        )


def editar(db: Session, reserva_id: int, item_id: int, datos: ReservaServicioUpdate) -> ReservaServicio:
    """Corrige la cantidad de un consumo. El precio sigue siendo el que se congeló al agregarlo."""
    reserva, item = _obtener_item(db, reserva_id, item_id)
    nuevo_costo = facturacion.costo_servicios(reserva) - item.cantidad * item.precio_unitario + datos.cantidad * item.precio_unitario
    _exigir_que_no_quede_pagado_de_mas(reserva, nuevo_costo)
    item.cantidad = datos.cantidad
    confirmar_cambios(db)
    db.refresh(item)
    return item


def quitar(db: Session, reserva_id: int, item_id: int) -> None:
    reserva, item = _obtener_item(db, reserva_id, item_id)
    _exigir_que_no_quede_pagado_de_mas(reserva, facturacion.costo_servicios(reserva) - item.cantidad * item.precio_unitario)
    db.delete(item)
    confirmar_cambios(db)
