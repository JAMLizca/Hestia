from pydantic import BaseModel, ConfigDict

class RoleBase(BaseModel):
    nombre: str
    description: str | None = None

"""Validación de datos para la creación de un rol."""

class RoleCreate(RoleBase):

 """Datos que la API devuelve al consultar un rol."""
class RoleOut(RoleBase):
    id: int
    
    model_config = ConfigDict(from_attributes=True)
