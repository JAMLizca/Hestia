"""
Administración de usuarios del staff: listar, consultar, editar, activar/desactivar
y cambiar la contraseña. Todo el módulo es solo para administradores.

El alta de usuarios sigue siendo `POST /auth/register`. No hay borrado: las reservas
guardan quién las creó, así que un usuario se desactiva en lugar de eliminarse.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from app.core.security import hash_password
from app.models.role import Role
from app.models.usuario import Usuario
from app.schemas.usuario import UsuarioDetalleOut, UsuarioPasswordUpdate, UsuarioUpdate

ROL_ADMIN = "administrador"

router = APIRouter(
    prefix="/usuarios",
    tags=["Usuarios"],
    dependencies=[Depends(require_roles(ROL_ADMIN))],
)

# Columnas NOT NULL: un null explícito daría error 500 en la base de datos.
CAMPOS_OBLIGATORIOS = ("nombre", "email", "rol_id", "activo")


def _obtener_o_404(db: Session, usuario_id: int) -> Usuario:
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No existe un usuario con id {usuario_id}",
        )
    return usuario


def _otros_admins_activos(db: Session, usuario_id: int) -> int:
    return (
        db.query(Usuario)
        .join(Role, Usuario.rol_id == Role.id)
        .filter(Role.nombre == ROL_ADMIN, Usuario.activo.is_(True), Usuario.id != usuario_id)
        .count()
    )


@router.get("/", response_model=list[UsuarioDetalleOut], summary="Lista los usuarios (solo administrador)")
def listar_usuarios(db: Session = Depends(get_db)):
    return db.query(Usuario).order_by(Usuario.id).all()


@router.get("/{usuario_id}", response_model=UsuarioDetalleOut, summary="Consulta un usuario por id (solo administrador)")
def obtener_usuario(usuario_id: int, db: Session = Depends(get_db)):
    return _obtener_o_404(db, usuario_id)


@router.put("/{usuario_id}", response_model=UsuarioDetalleOut, summary="Edita un usuario o lo activa/desactiva (solo administrador)")
def actualizar_usuario(
    usuario_id: int,
    usuario_in: UsuarioUpdate,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(get_current_user),
):
    usuario = _obtener_o_404(db, usuario_id)
    datos = usuario_in.model_dump(exclude_unset=True)

    for campo in CAMPOS_OBLIGATORIOS:
        if campo in datos and datos[campo] is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"El campo '{campo}' no puede ser nulo",
            )

    if "email" in datos:
        repetido = db.query(Usuario).filter(Usuario.email == datos["email"], Usuario.id != usuario_id).first()
        if repetido:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ya existe un usuario registrado con ese email",
            )

    nuevo_rol = usuario.rol
    if "rol_id" in datos and datos["rol_id"] != usuario.rol_id:
        nuevo_rol = db.query(Role).filter(Role.id == datos["rol_id"]).first()
        if not nuevo_rol:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"El rol con id {datos['rol_id']} no existe",
            )

    # Protecciones para que el sistema nunca se quede sin un administrador con acceso.
    es_propio = usuario.id == usuario_actual.id
    if es_propio and datos.get("activo") is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes desactivar tu propia cuenta",
        )
    if es_propio and "rol_id" in datos and datos["rol_id"] != usuario.rol_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes cambiar tu propio rol",
        )

    era_admin_activo = usuario.rol.nombre == ROL_ADMIN and usuario.activo
    seguira_siendo_admin_activo = nuevo_rol.nombre == ROL_ADMIN and datos.get("activo", usuario.activo)
    if era_admin_activo and not seguira_siendo_admin_activo and _otros_admins_activos(db, usuario_id) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debe quedar al menos un administrador activo",
        )

    for campo, valor in datos.items():
        setattr(usuario, campo, valor)
    db.commit()
    db.refresh(usuario)
    return usuario


@router.put(
    "/{usuario_id}/password",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Define una nueva contraseña para un usuario (solo administrador)",
)
def cambiar_password(usuario_id: int, datos: UsuarioPasswordUpdate, db: Session = Depends(get_db)):
    usuario = _obtener_o_404(db, usuario_id)
    usuario.password_hash = hash_password(datos.password)
    db.commit()