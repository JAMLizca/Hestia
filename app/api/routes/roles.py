"""
Endpoints de la entidad Role.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.role import Role
from app.schemas.role import RoleCreate, RoleOut

router = APIRouter(prefix="/roles", tags=["Roles"])


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
    summary="Crea un nuevo rol",
)
def crear_rol(rol: RoleCreate, db: Session = Depends(get_db)):
    """
    Crea un rol, va a retornar un error si ya existe un rol con el mismo nombre.
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