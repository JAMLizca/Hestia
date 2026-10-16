"""
Esquemas Pydantic para la entidad TipoHabitacion.
"""
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class TipoHabitacionBase(BaseModel):
    nombre: str
    descripcion: str | None = None
    capacidad_maxima: int = Field(gt=0)
    precio_base: Decimal = Field(gt=0)
    camas: int = Field(default=1, gt=0)
    metros_cuadrados: Decimal | None = None


class TipoHabitacionCreate(TipoHabitacionBase):
    """Datos requeridos para crear un tipo de habitación."""


class TipoHabitacionUpdate(BaseModel):
    """Todos los campos son opcionales: solo se actualiza lo que se va aenvíar."""

    nombre: str | None = None
    descripcion: str | None = None
    capacidad_maxima: int | None = Field(default=None, gt=0)
    precio_base: Decimal | None = Field(default=None, gt=0)
    camas: int | None = Field(default=None, gt=0)
    metros_cuadrados: Decimal | None = None


class TipoHabitacionOut(TipoHabitacionBase):
    id: int

    model_config = ConfigDict(from_attributes=True)