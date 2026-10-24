"""
Endpoints de autenticación: registro, login (JWT) y perfil del usuario atual.
"""
from fastapi import APIRouter, Depends, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.api.deps import TIPO_CLIENTE, TIPO_PERSONAL, get_current_user, get_db
from app.core.errores import ErrorNegocio
from app.core.limites import limitar_login, registrar_fallo_login
from app.core.security import create_access_token
from app.services import cuentas
from app.services import usuarios as servicio
from app.models.usuario import Usuario
from app.schemas.usuario import PasswordChange, Token, UsuarioCreate, UsuarioOut

router = APIRouter(prefix="/auth", tags=["Autenticación"])


@router.post(
    "/register",
    response_model=UsuarioOut,
    status_code=status.HTTP_201_CREATED,
    summary="Registra un nuevo usuario del staff (solo administrador)",
)
def registrar_usuario(usuario_in: UsuarioCreate, db: Session = Depends(get_db)):
    """
    Crear un usuario nuevo del personal. Solo un administrador autenticado puede hacerlo; el primer
    administrador se crea con `seed_roles.py`. Valida que el email no esté registrado y que el `rol_id`
    exista. La contraseña nunca se guarda en texto plano: se almacena su hash.
    """
    return servicio.crear(db, usuario_in)


@router.post(
    "/login",
    response_model=Token,
    summary="Inicia sesión (personal o huésped) y devuelve un token JWT",
    dependencies=[Depends(limitar_login)],
)
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """
    Recibe `username` (aquí se usa el email) y `password` como form-data, valida las
    credenciales y devuelve un token JWT.

    Hay un solo formulario de acceso: si el correo es de un usuario del personal se valida contra ese usuario; si no,
    contra las cuentas de huésped. El token lleva `tipo` ("personal" o "cliente"): el del huésped no sirve en el panel.
    Tras 10 intentos fallidos desde una misma IP se responde 429 por unos minutos.
    """
    try:
        if db.query(Usuario.id).filter(Usuario.email == form_data.username).first():
            usuario = servicio.autenticar(db, form_data.username, form_data.password)
            token = create_access_token(
                subject=str(usuario.id),
                extra_claims={"rol": usuario.rol.nombre, "tipo": TIPO_PERSONAL},
            )
        else:
            cuenta = cuentas.autenticar(db, form_data.username, form_data.password)
            token = create_access_token(subject=str(cuenta.id), extra_claims={"tipo": TIPO_CLIENTE})
    except ErrorNegocio:
        registrar_fallo_login(request)
        raise
    return Token(access_token=token)


@router.get(
    "/me",
    response_model=UsuarioOut,
    summary="Devuelve los datos del usuario autenticado",
)
def perfil_actual(usuario_actual: Usuario = Depends(get_current_user)):
    return usuario_actual


@router.put(
    "/me/password",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Cambia la contraseña del usuario autenticado",
)
def cambiar_mi_password(
    datos: PasswordChange,
    usuario_actual: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Exige la contraseña actual. Devuelve 400 (y no 401, que el frontend toma como sesión
    vencida) si la contraseña actual es incorrecta o si la nueva es igual a la actual.
    El token vigente sigue siendo válido.
    """
    servicio.cambiar_mi_password(db, usuario_actual, datos)
