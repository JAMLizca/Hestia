"""
Esquemas Pydantic para la entidad Usuario y para el token JWT.
"""
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UsuarioBase(BaseModel):
    nombre: str
    email: EmailStr

"""Datos requeridos para registrar un usuario nuevo."""
class UsuarioCreate(UsuarioBase):
    password: str = Field(min_length=8, description="Mínimo 8 caracteres")
    rol_id: int

"""Datos que la API devuelve al consultar un usuario. No se incluye la contraseña."""
class UsuarioOut(UsuarioBase):
    id: int
    rol_id: int
    activo: bool

    model_config = ConfigDict(from_attributes=True)

"""Respuesta del endpoint de login."""
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"