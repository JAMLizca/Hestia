from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, computed_field


class ReservaServicioCreate(BaseModel):
    servicio_id: int
    cantidad: int = Field(default=1, gt=0)


class ReservaServicioOut(BaseModel):
    id: int
    reserva_id: int
    servicio_id: int
    cantidad: int
    precio_unitario: Decimal
    fecha_consumo: datetime
    model_config = ConfigDict(from_attributes=True)

    @computed_field
    @property
    def subtotal(self) -> Decimal:
        return self.cantidad * self.precio_unitario