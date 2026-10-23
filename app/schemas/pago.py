"""
Esquemas Pydantic para los pagos asociados a una reserva.
"""
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class PagoCreate(BaseModel):
    # max_digits/decimal_places coinciden con la columna Numeric(10, 2);
    # max_length coincide con String(30). Así un dato fuera de rango da 422 y no 500.
    model_config = ConfigDict(str_strip_whitespace=True)

    monto: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    metodo_pago: str = Field(min_length=1, max_length=30)


class PagoOut(BaseModel):
    id: int
    reserva_id: int
    monto: Decimal
    metodo_pago: str
    estado: str
    fecha_pago: datetime
    referencia: str | None = None

    model_config = ConfigDict(from_attributes=True)