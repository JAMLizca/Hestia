"""
Esquemas Pydantic para la entidad Huesped.
"""
from datetime import date

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class HuespedBase(BaseModel):
    documento_identidad: str
    tipo_documento: str = Field(default="CC", description="CC, CE, pasaporte, etc.")
    nombres: str
    apellidos: str
    email: EmailStr | None = None
    telefono: str | None = None
    nacionalidad: str | None = None
    fecha_nacimiento: date | None = None
    preferencias: str | None = None


class HuespedCreate(HuespedBase):
    """Datos requeridos para registrar un huésped nuevo."""


class HuespedUpdate(BaseModel):
    """Todos los campos son opcionales: solo se actualiza lo que se evia."""

    tipo_documento: str | None = None
    nombres: str | None = None
    apellidos: str | None = None
    email: EmailStr | None = None

    telefono: str | None = None
    nacionalidad: str | None = None
    fecha_nacimiento: date | None = None
    preferencias: str | None = None


class HuespedOut(HuespedBase):
    id: int

    model_config = ConfigDict(from_attributes=True)
