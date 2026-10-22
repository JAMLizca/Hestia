"""
Endpoints de la entidad Role y de la matriz de permisos.
"""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from app.core.config import settings
from app.core.permisos import construir_matriz
from app.models.role import Role
from app.models.usuario import Usuario
from app.schemas.role import MatrizPermisos, RoleCreate, RoleOut, RoleUpdate

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
    return db.query(Role).order_by(Role.id).all()


# Va antes de cualquier ruta con parámetro para que "permisos" no se tome como un id.
@router.get(
    "/permisos",
    response_model=MatrizPermisos,
    summary="Matriz de permisos por módulo y usuarios por rol",
)
def matriz_permisos(request: Request, db: Session = Depends(get_db)):
    """
    Qué puede hacer cada rol en cada módulo, calculado a partir de las rutas reales
    de la API (lo que se muestra es lo que el backend aplica). Un rol creado después
    solo tiene acceso a lo que está abierto a cualquier usuario autenticado.
    """
    roles = db.query(Role).order_by(Role.id).all()
    total = dict(db.query(Usuario.rol_id, func.count(Usuario.id)).group_by(Usuario.rol_id).all())
    activos = dict(
        db.query(Usuario.rol_id, func.count(Usuario.id)).filter(Usuario.activo.is_(True)).group_by(Usuario.rol_id).all()
    )
    resumen = [
        {
            "id": r.id,
            "nombre": r.nombre,
            "description": r.description,
            "total_usuarios": total.get(r.id, 0),
            "usuarios_activos": activos.get(r.id, 0),
        }
        for r in roles
    ]
    modulos = construir_matriz(request.app, settings.API_V1_PREFIX, [r.nombre for r in roles])
    return {"roles": resumen, "modulos": modulos}


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


@router.put(
    "/{role_id}",
    response_model=RoleOut,
    summary="Edita la descripción de un rol (solo administradores)",
    dependencies=[Depends(require_roles("administrador"))],
)
def actualizar_rol(role_id: int, datos: RoleUpdate, db: Session = Depends(get_db)):
    """El nombre no se puede cambiar: los permisos se asignan por nombre de rol."""
    rol = db.query(Role).filter(Role.id == role_id).first()
    if not rol:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No existe un rol con id {role_id}")
    for campo, valor in datos.model_dump(exclude_unset=True).items():
        setattr(rol, campo, valor)
    db.commit()
    db.refresh(rol)
    return rol