"""
Endpoints de autenticación: registro, login (JWT) y perfil del usuario atual.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db
from app.core.security import create_access_token, hash_password, verify_password
from app.models.role import Role
from app.models.usuario import Usuario
from app.schemas.usuario import Token, UsuarioCreate, UsuarioOut

router = APIRouter(prefix="/auth", tags=["Autenticación"])


@router.post(
    "/register",
    response_model=UsuarioOut,
    status_code=status.HTTP_201_CREATED,
    summary="Registra un nuevo usuario del staff",
)
def registrar_usuario(usuario_in: UsuarioCreate, db: Session = Depends(get_db)):

    """
    Crear un usuario nuevo del personal. Valida que el email no
    esté registrado y que el `rol_id` indicado exista en la tabla `roles`.
    La contraseña nunca se guarda en texto plano: se almacena su hash.
    """

    existe = db.query(Usuario).filter(Usuario.email == usuario_in.email).first()
    if existe:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya existe un usuario registrado con ese email",
        )

    rol = db.query(Role).filter(Role.id == usuario_in.rol_id).first()
    if not rol:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El rol con id {usuario_in.rol_id} no existe",
        )

    nuevo_usuario = Usuario(
        nombre=usuario_in.nombre,
        email=usuario_in.email,
        password_hash=hash_password(usuario_in.password),
        rol_id=usuario_in.rol_id,
    )
    db.add(nuevo_usuario)
    db.commit()
    db.refresh(nuevo_usuario)
    return nuevo_usuario


@router.post(
    "/login",
    response_model=Token,
    summary="Inicia sesión y devuelve un token JWT",
)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """
    Recibe `username` (aquí se usa el email) y `password` como form-data, valida las
    credenciales y devuelve un token JWT.
    """
    usuario = db.query(Usuario).filter(Usuario.email == form_data.username).first()
    if not usuario or not verify_password(form_data.password, usuario.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not usuario.activo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El usuario está inactivo",
        )

    token = create_access_token(
        subject=str(usuario.id),
        extra_claims={"rol": usuario.rol.nombre},
    )
    return Token(access_token=token)


@router.get(
    "/me",
    response_model=UsuarioOut,
    summary="Devuelve los datos del usuario autenticado",
)
def perfil_actual(usuario_actual: Usuario = Depends(get_current_user)):
    return usuario_actual