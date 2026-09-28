"""
Resumen/factura de una reserva: costo habitación + servicios, y saldo pendiente.
"""
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db
from app.models.pago import Pago
from app.models.reserva import Reserva
from app.models.reserva_servicio import ReservaServicio
from app.schemas.factura import ResumenReserva, ServicioConsumido

router = APIRouter(prefix="/reservas/{reserva_id}/resumen", tags=["Facturación"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=ResumenReserva)
def obtener_resumen(reserva_id: int, db: Session = Depends(get_db)):
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No existe una reserva con id {reserva_id}")

    noches = (reserva.fecha_checkout_prevista - reserva.fecha_checkin_prevista).days

    items_servicio = db.query(ReservaServicio).filter(ReservaServicio.reserva_id == reserva_id).all()
    servicios_consumidos = [
        ServicioConsumido(
            servicio_nombre=item.servicio.nombre,
            cantidad=item.cantidad,
            precio_unitario=item.precio_unitario,

            subtotal=item.cantidad * item.precio_unitario,
        )
        for item in items_servicio
    ]
    costo_servicios = sum((s.subtotal for s in servicios_consumidos), Decimal("0"))
    costo_total = reserva.precio_total + costo_servicios

    montos_pagados = db.query(Pago.monto).filter(Pago.reserva_id == reserva_id, Pago.estado == "pagado").all()
    total_pagado = sum((m[0] for m in montos_pagados), Decimal("0"))

    return ResumenReserva(
        reserva_id=reserva.id,
        huesped_nombre=f"{reserva.huesped.nombres} {reserva.huesped.apellidos}",
        habitacion_numero=reserva.habitacion.numero,
        noches=noches,
        costo_habitacion=reserva.precio_total,
        servicios=servicios_consumidos,
        costo_servicios=costo_servicios,
        costo_total=costo_total,
        total_pagado=total_pagado,
        saldo_pendiente=costo_total - total_pagado,
    )
