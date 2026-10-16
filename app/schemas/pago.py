"""
Esquemas Pydantic para los pagos asociados a una reserva.
"""
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class PagoCreate(BaseModel):
    monto: Decimal = Field(gt=0)
    metodo_pago: str


class PagoOut(BaseModel):
    id: int
    reserva_id: int
    monto: Decimal
    metodo_pago: str
    estado: str
    fecha_pago: datetime

    model_config = ConfigDict(from_attributes=True)
