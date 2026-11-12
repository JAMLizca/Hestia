from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

# `precio` es Numeric(10, 2) en `app/models/servicio.py`.
PRECIO_MAX = Decimal("99999999.99")


class _ValidacionesServicio(BaseModel):
    @field_validator("nombre", "descripcion", "categoria", mode="before", check_fields=False)
    @classmethod
    def _recortar(cls, v):
        if not isinstance(v, str):
            return v
        v = v.strip()
        return v or None


class ServicioBase(_ValidacionesServicio):
    nombre: str = Field(min_length=1, max_length=100)
    descripcion: str | None = Field(default=None, max_length=255)
    precio: Decimal = Field(gt=0, le=PRECIO_MAX, decimal_places=2)
    categoria: str | None = Field(default=None, max_length=50)


class ServicioCreate(ServicioBase):
    pass


class ServicioUpdate(_ValidacionesServicio):
    nombre: str | None = Field(default=None, min_length=1, max_length=100)
    descripcion: str | None = Field(default=None, max_length=255)
    precio: Decimal | None = Field(default=None, gt=0, le=PRECIO_MAX, decimal_places=2)
    categoria: str | None = Field(default=None, max_length=50)


class ServicioOut(ServicioBase):
    id: int
    model_config = ConfigDict(from_attributes=True)