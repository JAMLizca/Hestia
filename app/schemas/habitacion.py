"""
Esquemas Pydantic para la entidad Habitacion.
"""
from typing import Literal

from pydantic import BaseModel, ConfigDict

EstadoHabitacion = Literal["disponible", "ocupada", "mantenimiento", "limpieza"]


class HabitacionBase(BaseModel):
    numero: str
    tipo_habitacion_id: int
    piso: int | None = None
    estado: EstadoHabitacion = "disponible"
    caracteristicas: str | None = None


class HabitacionCreate(HabitacionBase):
    """Datos requeridos para crear una habitación."""


class HabitacionUpdate(BaseModel):
    """Todos los campos son opcionales: solo se actualiza lo que se va a envíar."""

    tipo_habitacion_id: int | None = None
    piso: int | None = None
    estado: EstadoHabitacion | None = None
    caracteristicas: str | None = None


class HabitacionOut(HabitacionBase):
    id: int

    model_config = ConfigDict(from_attributes=True)