"""
Esquemas Pydantic para la entidad Usuario y para el token JWT.
"""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UsuarioBase(BaseModel):
    nombre: str = Field(min_length=1, max_length=100)
    email: EmailStr


class UsuarioCreate(UsuarioBase):
    """Datos requeridos para registrar un usuario nuevo."""

    # bcrypt solo usa los primeros 72 bytes de la contraseña: se limita para no aceptar más.
    password: str = Field(min_length=8, max_length=72, description="Entre 8 y 72 caracteres")
    rol_id: int


class UsuarioOut(UsuarioBase):
    """Datos que la API devuelve al consultar un usuario. No se incluye la contraseña."""

    id: int
    rol_id: int
    activo: bool

    model_config = ConfigDict(from_attributes=True)


class UsuarioDetalleOut(UsuarioOut):
    """Usuario con su fecha de creación (listado de administración)."""

    fecha_creacion: datetime | None = None


class UsuarioUpdate(BaseModel):
    """Todos los campos son opcionales: solo se actualiza lo que se envíe."""

    model_config = ConfigDict(str_strip_whitespace=True)

    nombre: str | None = Field(default=None, min_length=1, max_length=100)
    email: EmailStr | None = None
    rol_id: int | None = None
    activo: bool | None = None


class UsuarioPasswordUpdate(BaseModel):
    """Nueva contraseña definida por un administrador."""

    password: str = Field(min_length=8, max_length=72, description="Entre 8 y 72 caracteres")


class PasswordChange(BaseModel):
    """Cambio de contraseña del propio usuario: exige la contraseña actual."""

    password_actual: str = Field(min_length=1, max_length=72)
    password_nueva: str = Field(min_length=8, max_length=72, description="Entre 8 y 72 caracteres")


class Token(BaseModel):
    """Respuesta del endpoint de login."""

    access_token: str
    token_type: str = "bearer"