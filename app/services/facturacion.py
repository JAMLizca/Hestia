"""Cálculo de lo que debe y lo que ha pagado una reserva (única fuente para facturación, pagos y consumos)."""
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.errores import NoEncontrado
from app.models.reserva import Reserva
from app.schemas.factura import ResumenReserva, ServicioConsumido


def costo_servicios(reserva: Reserva) -> Decimal:
    return sum((i.cantidad * i.precio_unitario for i in reserva.reserva_servicios), Decimal("0"))


def costo_total(reserva: Reserva) -> Decimal:
    return reserva.precio_total + costo_servicios(reserva)


def total_pagado(reserva: Reserva) -> Decimal:
    """Solo cuentan los pagos en estado 'pagado': los anulados, rechazados y pendientes no suman."""
    return sum((p.monto for p in reserva.pagos if p.estado == "pagado"), Decimal("0"))


def saldo_pendiente(reserva: Reserva) -> Decimal:
    return costo_total(reserva) - total_pagado(reserva)


def obtener_reserva(db: Session, reserva_id: int) -> Reserva:
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise NoEncontrado(f"No existe una reserva con id {reserva_id}")
    return reserva


def resumen(db: Session, reserva_id: int) -> ResumenReserva:
    reserva = obtener_reserva(db, reserva_id)
    servicios = [
        ServicioConsumido(
            servicio_nombre=i.servicio.nombre, cantidad=i.cantidad, precio_unitario=i.precio_unitario,
            subtotal=i.cantidad * i.precio_unitario,
        )
        for i in reserva.reserva_servicios
    ]
    return ResumenReserva(
        reserva_id=reserva.id,
        huesped_nombre=f"{reserva.huesped.nombres} {reserva.huesped.apellidos}",
        habitacion_numero=reserva.habitacion.numero,
        noches=(reserva.fecha_checkout_prevista - reserva.fecha_checkin_prevista).days,
        costo_habitacion=reserva.precio_total,
        servicios=servicios,
        costo_servicios=costo_servicios(reserva),
        costo_total=costo_total(reserva),
        total_pagado=total_pagado(reserva),
        saldo_pendiente=saldo_pendiente(reserva),
    )
