"""
Administración de usuarios del staff: listar, consultar, editar, activar/desactivar, cambiar la contraseña y
eliminar. Todo el módulo es solo para administradores. Las reglas están en app/services/usuarios.py.

El alta de usuarios sigue siendo `POST /auth/register`.
"""
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from app.models.usuario import Usuario
from app.schemas.usuario import UsuarioDetalleOut, UsuarioPasswordUpdate, UsuarioUpdate
from app.services import usuarios as servicio

router = APIRouter(prefix="/usuarios", tags=["Usuarios"], dependencies=[Depends(require_roles(servicio.ROL_ADMIN))])


@router.get("/", response_model=list[UsuarioDetalleOut], summary="Lista los usuarios (solo administrador)")
def listar_usuarios(db: Session = Depends(get_db)):
    return servicio.listar(db)


@router.get("/{usuario_id}", response_model=UsuarioDetalleOut, summary="Consulta un usuario por id (solo administrador)")
def obtener_usuario(usuario_id: int, db: Session = Depends(get_db)):
    return servicio.obtener(db, usuario_id)


@router.put("/{usuario_id}", response_model=UsuarioDetalleOut, summary="Edita un usuario o lo activa/desactiva (solo administrador)")
def actualizar_usuario(usuario_id: int, usuario_in: UsuarioUpdate, db: Session = Depends(get_db), usuario_actual: Usuario = Depends(get_current_user)):
    return servicio.editar(db, usuario_id, usuario_in, usuario_actual)


@router.put("/{usuario_id}/password", status_code=status.HTTP_204_NO_CONTENT, summary="Define una nueva contraseña para un usuario (solo administrador)")
def cambiar_password(usuario_id: int, datos: UsuarioPasswordUpdate, db: Session = Depends(get_db)):
    servicio.definir_password(db, usuario_id, datos)


@router.delete("/{usuario_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Elimina un usuario que nunca registró actividad (solo administrador)")
def eliminar_usuario(usuario_id: int, db: Session = Depends(get_db), usuario_actual: Usuario = Depends(get_current_user)):
    """
    No se puede eliminar a sí mismo ni al último administrador activo (400). Si ya creó reservas o validó
    pre-check-ins responde 409: hay que desactivarlo para conservar el historial.
    """
    servicio.eliminar(db, usuario_id, usuario_actual)
