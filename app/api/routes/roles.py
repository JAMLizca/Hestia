"""
Endpoints de la entidad Role.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db, require_roles
from app.models.role import Role
from app.schemas.role import RoleCreate, RoleOut

router = APIRouter(
    prefix="/roles",
    tags=["Roles"],
    dependencies=[Depends(get_current_user)],
)


@router.get(
    "/",
    response_model=list[RoleOut],
    summary="Lista todos los roles registrados",
)
def listar_roles(db: Session = Depends(get_db)):
    """Devuelve todos los roles disponibles en el sistema."""
    return db.query(Role).all()


@router.post(
    "/",
    response_model=RoleOut,
    status_code=status.HTTP_201_CREATED,
    summary="Crea un nuevo rol (solo administradores)",
    dependencies=[Depends(require_roles("administrador"))],
)
def crear_rol(rol: RoleCreate, db: Session = Depends(get_db)):
    """
    Crear un rol nuevo, va a retorna 400 si ya existe un rol con el mismo nombre, y 403 si quien
    hace la petición no tiene rol "administrador".
    """
    existe = db.query(Role).filter(Role.nombre == rol.nombre).first()
    if existe:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ya existe un rol con el nombre '{rol.nombre}'",
        )

    nuevo_rol = Role(**rol.model_dump())
    db.add(nuevo_rol)
    db.commit()
    db.refresh(nuevo_rol)
    return nuevo_rol