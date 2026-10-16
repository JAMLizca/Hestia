from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class ServicioBase(BaseModel):
    nombre: str
    descripcion: str | None = None
    precio: Decimal = Field(gt=0)
    categoria: str | None = None


class ServicioCreate(ServicioBase):
    pass


class ServicioUpdate(BaseModel):
    nombre: str | None = None
    descripcion: str | None = None
    precio: Decimal | None = Field(default=None, gt=0)
    categoria: str | None = None


class ServicioOut(ServicioBase):
    id: int
    model_config = ConfigDict(from_attributes=True)