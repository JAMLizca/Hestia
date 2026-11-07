"""
Endpoints de roles y de la matriz de permisos.
"""
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.role import Role
from app.schemas.role import MatrizPermisos, RoleCreate, RoleOut, RoleUpdate
from app.services import roles as servicio

router = APIRouter(prefix="/roles", tags=["Roles"], dependencies=[Depends(get_current_user)])


@router.get("/", response_model=list[RoleOut], summary="Lista todos los roles registrados")
def listar_roles(db: Session = Depends(get_db)):
    return servicio.listar(db)


# Va antes de cualquier ruta con parámetro para que "permisos" no se tome como un id.
@router.get("/permisos", response_model=MatrizPermisos, summary="Matriz de permisos por módulo y usuarios por rol")
def matriz_permisos(request: Request, db: Session = Depends(get_db)):
    """
    Qué puede hacer cada rol en cada módulo, según la tabla de app/core/permisos.py.
    Un rol creado después no puede hacer nada hasta que se agregue a esa tabla.
    """
    return servicio.matriz(db, request.app)


@router.post(
    "/",
    response_model=RoleOut,
    status_code=status.HTTP_201_CREATED,
    summary="Crea un nuevo rol (solo administradores)",
)
def crear_rol(rol: RoleCreate, db: Session = Depends(get_db)):
    """400 si ya existe un rol con el mismo nombre;
       403 si quien lo pide no es administrador.
    """
    return servicio.crear(db, rol)


@router.put(
    "/{role_id}",
    response_model=RoleOut,
    summary="Edita la descripción de un rol (solo administradores)",
)
def actualizar_rol(role_id: int, datos: RoleUpdate, db: Session = Depends(get_db)):
    return servicio.editar(db, role_id, datos)


@router.delete(
    "/{role_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Elimina un rol sin usuarios (solo administradores)",
)
def eliminar_rol(role_id: int, db: Session = Depends(get_db)):
    servicio.eliminar(db, role_id)
