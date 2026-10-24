"""Roles y matriz de permisos."""
from fastapi import FastAPI
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errores import Conflicto, NoEncontrado, SolicitudInvalida
from app.core.permisos import construir_matriz
from app.models.role import Role
from app.models.usuario import Usuario
from app.schemas.role import RoleCreate, RoleUpdate
from app.services._comun import confirmar_cambios

# Los permisos del código se asignan por el nombre de estos roles: borrarlos dejaría rutas sin quién las use.
ROLES_BASE = ("administrador", "gerente", "recepcionista", "auditor")


def listar(db: Session) -> list[Role]:
    return db.query(Role).order_by(Role.id).all()


def obtener(db: Session, role_id: int) -> Role:
    rol = db.query(Role).filter(Role.id == role_id).first()
    if not rol:
        raise NoEncontrado(f"No existe un rol con id {role_id}")
    return rol


def crear(db: Session, datos: RoleCreate) -> Role:
    if db.query(Role).filter(Role.nombre == datos.nombre).first():
        raise SolicitudInvalida(f"Ya existe un rol con el nombre '{datos.nombre}'")
    nuevo = Role(**datos.model_dump())
    db.add(nuevo)
    confirmar_cambios(db)
    db.refresh(nuevo)
    return nuevo


def editar(db: Session, role_id: int, datos: RoleUpdate) -> Role:
    rol = obtener(db, role_id)
    for campo, valor in datos.model_dump(exclude_unset=True).items():
        setattr(rol, campo, valor)
    confirmar_cambios(db)
    db.refresh(rol)
    return rol


def eliminar(db: Session, role_id: int) -> None:
    rol = obtener(db, role_id)
    if rol.nombre in ROLES_BASE:
        raise Conflicto(f"El rol '{rol.nombre}' es parte del sistema y no se puede eliminar")
    usuarios = db.query(Usuario).filter(Usuario.rol_id == role_id).count()
    if usuarios:
        raise Conflicto(f"No se puede eliminar: {usuarios} usuario(s) tienen este rol. Cámbiales el rol primero.")
    db.delete(rol)
    confirmar_cambios(db)


def matriz(db: Session, app: FastAPI) -> dict:
    roles = listar(db)
    total = dict(db.query(Usuario.rol_id, func.count(Usuario.id)).group_by(Usuario.rol_id).all())
    activos = dict(db.query(Usuario.rol_id, func.count(Usuario.id)).filter(Usuario.activo.is_(True)).group_by(Usuario.rol_id).all())
    resumen = [
        {"id": r.id, "nombre": r.nombre, "description": r.description, "total_usuarios": total.get(r.id, 0), "usuarios_activos": activos.get(r.id, 0)}
        for r in roles
    ]
    return {"roles": resumen, "modulos": construir_matriz(app, settings.API_V1_PREFIX, [r.nombre for r in roles])}
