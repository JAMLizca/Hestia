"""
Esquemas Pydantic para la entidad Reserva.
"""
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

EstadoReserva = Literal["pendiente", "confirmada", "checkin", "checkout", "cancelada", "no_show"]
CanalReserva = Literal["presencial", "telefono", "whatsapp", "correo", "web", "otro"]


def _notas_o_none(valor):
    if isinstance(valor, str):
        valor = valor.strip()
        return valor or None
    return valor


class PreferenciasReserva(BaseModel):
    """Preferencias del huésped para esta estadía (RF-20). Todas son opcionales."""

    model_config = ConfigDict(extra="forbid")

    piso: Literal["bajo", "alto"] | None = None
    vista: Literal["exterior", "interior"] | None = None
    cama: Literal["doble", "sencillas"] | None = None
    tranquila: bool = False
    accesible: bool = False

    def compactas(self) -> dict | None:
        """Solo lo que el huésped pidió; None si no pidió nada (así se guarda en la base)."""
        pedidas = {k: v for k, v in self.model_dump().items() if v not in (None, False)}
        return pedidas or None


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
    Datos requeridos para crear una reserva. El precio, el código, el estado inicial
    ('pendiente') y el usuario que gestiona se calculan en el backend,
    no se reciben del cliente.
    """

    canal: CanalReserva = "presencial"
    notas: str | None = Field(default=None, max_length=500)
    preferencias: PreferenciasReserva | None = None

    @field_validator("notas", mode="before")
    @classmethod
    def _limpiar_notas(cls, valor):
        return _notas_o_none(valor)


class ReservaUpdate(BaseModel):
    """
    Edición parcial: solo se cambia lo que se envíe. Qué campos se pueden editar
    depende del estado de la reserva (ver PUT /reservas/{id}). El huésped no se cambia.
    """

    model_config = ConfigDict(extra="forbid")

    habitacion_id: int | None = None
    fecha_checkin_prevista: date | None = None
    fecha_checkout_prevista: date | None = None
    num_huespedes: int | None = Field(default=None, gt=0)
    canal: CanalReserva | None = None
    notas: str | None = Field(default=None, max_length=500)
    preferencias: PreferenciasReserva | None = None

    @field_validator("notas", mode="before")
    @classmethod
    def _limpiar_notas(cls, valor):
        return _notas_o_none(valor)


class ReservaOut(ReservaBase):
    id: int
    codigo: str
    canal: CanalReserva
    notas: str | None = None
    temporada: str = "baja"
    preferencias: dict | None = None
    motivo_cancelacion: str | None = None
    precheckin_estado: str | None = None
    usuario_id: int
    estado: EstadoReserva
    precio_total: Decimal
    fecha_checkin_real: datetime | None = None
    fecha_checkout_real: datetime | None = None
    fecha_creacion: datetime

    model_config = ConfigDict(from_attributes=True)
