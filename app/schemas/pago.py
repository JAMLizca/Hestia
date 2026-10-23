"""
Esquemas Pydantic para los pagos asociados a una reserva.
"""
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class PagoCreate(BaseModel):
    # max_digits/decimal_places coinciden con la columna Numeric(10, 2);
    # max_length coincide con String(30). Así un dato fuera de rango da 422 y no 500.
    model_config = ConfigDict(str_strip_whitespace=True)

    monto: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    metodo_pago: str = Field(min_length=1, max_length=30)


class PagoUpdate(BaseModel):
    """Corrección de un pago manual: solo se cambia lo que se envíe."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    monto: Decimal | None = Field(default=None, gt=0, max_digits=10, decimal_places=2)
    metodo_pago: str | None = Field(default=None, min_length=1, max_length=30)

    @model_validator(mode="after")
    def _algo_que_cambiar(self):
        if not self.model_fields_set:
            raise ValueError("Envía al menos un campo para modificar")
        if "monto" in self.model_fields_set and self.monto is None:
            raise ValueError("El monto no puede ser nulo")
        if "metodo_pago" in self.model_fields_set and self.metodo_pago is None:
            raise ValueError("El método de pago no puede ser nulo")
        return self


class PagoAnular(BaseModel):
    """Anular un pago exige dejar el motivo (queda como rastro de la corrección)."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    motivo: str = Field(min_length=3, max_length=200)


class PagoOut(BaseModel):
    id: int
    reserva_id: int
    monto: Decimal
    metodo_pago: str
    estado: str
    fecha_pago: datetime
    referencia: str | None = None
    motivo_anulacion: str | None = None

    model_config = ConfigDict(from_attributes=True)