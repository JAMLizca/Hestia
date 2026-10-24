"""Dependencias reutilizables para los endpoints de la API.
"""

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.core.security import decode_access_token
from app.core.vencimiento import expirar_pendientes
from app.db.session import get_db
from app.models.cuenta_huesped import CuentaHuesped
from app.models.usuario import Usuario

# tokenUrl le indica a Swagger dónde está el endpoint de login para el botón "Authorize".
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")
# Igual, pero sin exigir el token: la verificación de permisos corre en TODAS las rutas y las públicas no llevan sesión.
oauth2_opcional = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

TIPO_PERSONAL = "personal"
TIPO_CLIENTE = "cliente"


def get_current_user(
    request: Request,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> Usuario:
    """
    Decodifica el JWT recibido en el header `Authorization: Bearer <token>`
    y carga el usuario correspondiente desde la DB.
    """
    # verificar_permiso (dependencia global) ya lo cargó en esta misma petición: no se consulta dos veces.
    ya_cargado = getattr(request.state, "usuario", None)
    if ya_cargado is not None:
        return ya_cargado

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudo validar las credenciales",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token)
        usuario_id = payload.get("sub")
        if usuario_id is None:
            raise credentials_exception
        # El token de un huésped lleva tipo="cliente" y su "sub" es el id de OTRA tabla: jamás vale como personal.
        # Los tokens del personal anteriores a las cuentas de huésped no traen "tipo" y siguen siendo válidos.
        if payload.get("tipo", TIPO_PERSONAL) != TIPO_PERSONAL:
            raise credentials_exception
        # int() dentro del try: un "sub" no numérico da 401 y no un error 500.
        usuario_id = int(usuario_id)
    except (ValueError, TypeError):
        raise credentials_exception

    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if usuario is None or not usuario.activo:
        raise credentials_exception
    return usuario


def verificar_permiso(
    request: Request,
    token: str | None = Depends(oauth2_opcional),
    db: Session = Depends(get_db),
) -> None:
    """
    Dependencia global: aplica la tabla de permisos (app/core/permisos.py) a cada ruta del personal.
    Sin sesión válida → 401; con sesión pero sin permiso para (módulo, acción) → 403.
    Las rutas públicas, el login y las del huésped no están en la matriz y pasan sin tocarse.
    """
    from app.core.config import settings
    from app.core.permisos import clasificar_peticion, roles_permitidos

    ruta = getattr(request.scope.get("route"), "path", "")
    if not ruta.startswith(settings.API_V1_PREFIX):
        return
    clave = clasificar_peticion(ruta[len(settings.API_V1_PREFIX):], request.method)
    if clave is None:
        return
    usuario = get_current_user(request=request, token=token or "", db=db)
    request.state.usuario = usuario
    if usuario.rol.nombre not in roles_permitidos(*clave):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permisos para realizar esta acción")


def get_cuenta_actual(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> CuentaHuesped:
    """Cuenta de huésped autenticada. Rechaza cualquier token que no sea de huésped (incluido el del personal)."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Inicia sesión con tu cuenta de huésped para continuar",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token)
        if payload.get("tipo") != TIPO_CLIENTE:
            raise credentials_exception
        cuenta_id = int(payload.get("sub"))
    except (ValueError, TypeError):
        raise credentials_exception
    cuenta = db.get(CuentaHuesped, cuenta_id)
    if cuenta is None or not cuenta.activo:
        raise credentials_exception
    return cuenta


def liberar_pendientes_vencidas(db: Session = Depends(get_db)) -> None:
    """
    Dependencia de las rutas de reservas y disponibilidad: antes de responder, cancela las
    reservas pendientes vencidas (ver app/core/vencimiento.py). Se declara después de
    `get_current_user` para que una petición sin sesión no ejecute nada.
    """
    expirar_pendientes(db)


def require_roles(*roles_permitidos: str):
    def _verificar_rol(usuario: Usuario = Depends(get_current_user)) -> Usuario:
        if usuario.rol.nombre not in roles_permitidos:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para realizar esta acción",
            )
        return usuario

    _verificar_rol.roles_permitidos = roles_permitidos
    return _verificar_rol


__all__ = ["get_db", "get_current_user", "get_cuenta_actual", "TIPO_CLIENTE", "TIPO_PERSONAL", "liberar_pendientes_vencidas", "require_roles"]