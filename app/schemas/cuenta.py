"""
Esquemas de las cuentas de huésped (registro, perfil).
"""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class RegistroCuenta(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    nombres: str = Field(min_length=1, max_length=100)
    apellidos: str = Field(min_length=1, max_length=100)
    email: EmailStr
    # bcrypt solo usa los primeros 72 bytes de la contraseña: se limita para no aceptar más.
    password: str = Field(min_length=8, max_length=72, description="Entre 8 y 72 caracteres")

    @field_validator("email")
    @classmethod
    def _minusculas(cls, v: str) -> str:
        return v.lower()


class CuentaOut(BaseModel):
    id: int
    nombres: str
    apellidos: str
    email: EmailStr
    fecha_creacion: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
