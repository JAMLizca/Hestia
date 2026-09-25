"""
Esquemas Pydantic para la entidad Reserva.
"""
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

EstadoReserva = Literal["pendiente", "confirmada", "checkin", "checkout", "cancelada"]


class ReservaBase(BaseModel):
    huesped_id: int
    habitacion_id: int
    fecha_checkin_prevista: date
    fecha_checkout_prevista: date
    num_huespedes: int = Field(gt=0)

    @field_validator("fecha_checkout_prevista")
    @classmethod
    def _checkout_posterior_a_checkin(cls, v: date, info):
        checkin = info.data.get("fecha_checkin_prevista")
        if checkin and v <= checkin:
            raise ValueError("La fecha de checkout debe ser posterior a la de checkin")
        return v


class ReservaCreate(ReservaBase):
    """
    Datos requeridos para crear una reserva. El precio, el estado inicial

    ('pendiente') y el usuario que gestiona se calculan en el backend,
    no se reciben del cliente.
    """


class ReservaOut(ReservaBase):
    id: int
    usuario_id: int
    estado: EstadoReserva
    precio_total: Decimal
    fecha_checkin_real: datetime | None = None
    fecha_checkout_real: datetime | None = None
    fecha_creacion: datetime

    model_config = ConfigDict(from_attributes=True)
