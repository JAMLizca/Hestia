"""
Esquemas Pydantic para la entidad TipoHabitacion.
"""
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

# Topes alineados con las columnas de `app/models/tipo_habitacion.py`:
# precio_base es Numeric(10, 2) y metros_cuadrados Numeric(6, 2).
PRECIO_MAX = Decimal("99999999.99")
METROS_MAX = Decimal("9999.99")


class _ValidacionesTipo(BaseModel):
    @field_validator("nombre", "descripcion", mode="before", check_fields=False)
    @classmethod
    def _recortar(cls, v):
        if not isinstance(v, str):
            return v
        v = v.strip()
        return v or None


class TipoHabitacionBase(_ValidacionesTipo):
    nombre: str = Field(min_length=1, max_length=80)
    descripcion: str | None = Field(default=None, max_length=255)
    capacidad_maxima: int = Field(gt=0, le=20)
    precio_base: Decimal = Field(gt=0, le=PRECIO_MAX, decimal_places=2)
    camas: int = Field(default=1, gt=0, le=20)
    metros_cuadrados: Decimal | None = Field(default=None, gt=0, le=METROS_MAX, decimal_places=2)


class TipoHabitacionCreate(TipoHabitacionBase):
    """Datos requeridos para crear un tipo de habitación."""


class TipoHabitacionUpdate(_ValidacionesTipo):
    """Todos los campos son opcionales: solo se actualiza lo que se va a enviar."""

    nombre: str | None = Field(default=None, min_length=1, max_length=80)
    descripcion: str | None = Field(default=None, max_length=255)
    capacidad_maxima: int | None = Field(default=None, gt=0, le=20)
    precio_base: Decimal | None = Field(default=None, gt=0, le=PRECIO_MAX, decimal_places=2)
    camas: int | None = Field(default=None, gt=0, le=20)
    metros_cuadrados: Decimal | None = Field(default=None, gt=0, le=METROS_MAX, decimal_places=2)


class TipoHabitacionOut(TipoHabitacionBase):
    id: int

    model_config = ConfigDict(from_attributes=True)