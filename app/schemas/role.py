"""
Esquemas Pydantic para roles y para la matriz de permisos.
"""
from pydantic import BaseModel, ConfigDict, Field, field_validator


def _texto_o_none(valor):
    if isinstance(valor, str):
        valor = valor.strip()
        return valor or None
    return valor


class RoleBase(BaseModel):
    nombre: str = Field(min_length=1, max_length=50)
    description: str | None = Field(default=None, max_length=255)

    @field_validator("description", mode="before")
    @classmethod
    def _limpiar_descripcion(cls, valor):
        return _texto_o_none(valor)


class RoleCreate(RoleBase):
    """
   Crear un rol. El nombre se guarda en minúsculas y sin espacios.
    """

    @field_validator("nombre", mode="before")
    @classmethod
    def _normalizar_nombre(cls, valor):
        return valor.strip().lower() if isinstance(valor, str) else valor


class RoleUpdate(BaseModel):

    model_config = ConfigDict(extra="forbid")

    description: str | None = Field(default=None, max_length=255)

    @field_validator("description", mode="before")
    @classmethod
    def _limpiar_descripcion(cls, valor):
        return _texto_o_none(valor)


class RoleOut(RoleBase):

    id: int

    model_config = ConfigDict(from_attributes=True)


class RolResumen(RoleOut):
    total_usuarios: int
    usuarios_activos: int


class PermisoAccion(BaseModel):
    accion: str  # ver | crear | editar | estado | eliminar
    etiqueta: str
    roles: list[str]  # nombres de los roles que pueden realizar la acción
    notas: dict[str, str] = {}  # aclaraciones por rol (p. ej. "solo el estado")


class ModuloPermisos(BaseModel):
    clave: str
    nombre: str
    acciones: list[PermisoAccion]


class MatrizPermisos(BaseModel):
    roles: list[RolResumen]
    modulos: list[ModuloPermisos]