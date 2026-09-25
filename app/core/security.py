""" 
Hashing de contrasenas y manejo de tokens jwt.
"""

from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

"""Genera el hash de contraseña en texto plano."""
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

"""Verifica lacontraseña en texto plano contra su hash almacenado."""
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

"""
    Genera un JWT firmado. `subject` suele ser el id del usuario
    (string), y `extra_claims` permite incluir datos adicionales para no tener que consultar la DB
    en cada request solo para saber el rol.
    """
def create_access_token(subject: str, extra_claims: dict | None = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    to_encode: dict = {"sub": subject, "exp": expire}
    if extra_claims:
        to_encode.update(extra_claims)
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

"""Decodifica y valida un JWT. Lanza ValueError si es inválido o ya expiró."""
def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError as exc:
        raise ValueError("Token inválido o expirado") from exc