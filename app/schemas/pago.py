from decimal import Decimal

from pydantic import BaseModel


class ServicioConsumido(BaseModel):
    servicio_nombre: str
    cantidad: int
    precio_unitario: Decimal
    subtotal: Decimal


class ResumenReserva(BaseModel):
    reserva_id: int
    huesped_nombre: str
    habitacion_numero: str
    noches: int
    costo_habitacion: Decimal
    servicios: list[ServicioConsumido]
    costo_servicios: Decimal
    costo_total: Decimal
    total_pagado: Decimal
    saldo_pendiente: Decimal