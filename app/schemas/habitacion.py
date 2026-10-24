"""
Esquemas Pydantic para la entidad Habitacion.
"""
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, StringConstraints

EstadoHabitacion = Literal["disponible", "ocupada", "mantenimiento", "limpieza"]
# Número o nombre corto de la habitación (columna de 10 caracteres, única): "101", "Suite 2", "PH-1".
NumeroHabitacion = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=10)]


class HabitacionBase(BaseModel):
    numero: NumeroHabitacion
    tipo_habitacion_id: int
    piso: int | None = None
    estado: EstadoHabitacion = "disponible"
    caracteristicas: str | None = None


class HabitacionCreate(HabitacionBase):
    """Datos requeridos para crear una habitación."""


class HabitacionUpdate(BaseModel):
    """Todos los campos son opcionales: solo se actualiza lo que se va a envíar."""

    numero: NumeroHabitacion | None = None
    tipo_habitacion_id: int | None = None
    piso: int | None = None
    estado: EstadoHabitacion | None = None
    caracteristicas: str | None = None


class HabitacionOut(HabitacionBase):
    id: int

    model_config = ConfigDict(from_attributes=True)