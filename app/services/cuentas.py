"""
Cuentas de huésped: quien quiere reservar en línea crea una cuenta y entra con ella.

Reglas:
  - El correo es único entre las cuentas de huésped Y el personal (un mismo correo no puede ser de las dos, porque el
    inicio de sesión es uno solo y no sabría a cuál entrar).
  - Una cuenta solo ve y gestiona las reservas que ella misma hizo (reservas.cuenta_id).
"""
from sqlalchemy.orm import Session

from app.core.errores import Conflicto, NoAutenticado, NoEncontrado, Prohibido
from app.core.security import hash_password, verify_password
from app.models.cuenta_huesped import CuentaHuesped
from app.models.reserva import Reserva
from app.models.usuario import Usuario
from app.schemas.cuenta import RegistroCuenta
from app.services._comun import confirmar_cambios

# Hash de una contraseña inexistente: se verifica igual cuando el correo no existe, para que el tiempo de
# respuesta no revele qué correos tienen cuenta.
_HASH_FALSO = hash_password("no-es-una-contrasena-real")


def correo_en_uso(db: Session, email: str, ignorar_usuario_id: int | None = None) -> bool:
    """True si el correo ya pertenece a una cuenta de huésped o a un usuario del personal."""
    email = email.strip().lower()
    if db.query(CuentaHuesped.id).filter(CuentaHuesped.email == email).first():
        return True
    q = db.query(Usuario.id).filter(Usuario.email == email)
    if ignorar_usuario_id is not None:
        q = q.filter(Usuario.id != ignorar_usuario_id)
    return q.first() is not None


def registrar(db: Session, datos: RegistroCuenta) -> CuentaHuesped:
    if correo_en_uso(db, datos.email):
        # Mensaje genérico a propósito: no confirma si el correo es del personal.
        raise Conflicto("Ese correo ya tiene una cuenta. Inicia sesión o usa otro correo.")
    cuenta = CuentaHuesped(nombres=datos.nombres, apellidos=datos.apellidos, email=datos.email, password_hash=hash_password(datos.password))
    db.add(cuenta)
    confirmar_cambios(db)
    db.refresh(cuenta)
    return cuenta


def buscar_para_login(db: Session, email: str) -> CuentaHuesped | None:
    return db.query(CuentaHuesped).filter(CuentaHuesped.email == email.strip().lower()).first()


def autenticar(db: Session, email: str, password: str) -> CuentaHuesped:
    cuenta = buscar_para_login(db, email)
    if cuenta is None:
        verify_password(password, _HASH_FALSO)
        raise NoAutenticado("Email o contraseña incorrectos")
    if not verify_password(password, cuenta.password_hash):
        raise NoAutenticado("Email o contraseña incorrectos")
    if not cuenta.activo:
        raise Prohibido("Tu cuenta está desactivada. Comunícate con el hotel.")
    return cuenta


def reservas_de(db: Session, cuenta: CuentaHuesped) -> list[Reserva]:
    return db.query(Reserva).filter(Reserva.cuenta_id == cuenta.id).order_by(Reserva.fecha_creacion.desc(), Reserva.id.desc()).all()


def reserva_de(db: Session, cuenta: CuentaHuesped, codigo: str) -> Reserva:
    """La reserva con ese código, solo si es de esta cuenta (si es de otra, es como si no existiera)."""
    reserva = db.query(Reserva).filter(Reserva.codigo == codigo.strip().upper(), Reserva.cuenta_id == cuenta.id).first()
    if reserva is None:
        raise NoEncontrado("No encontramos esa reserva en tu cuenta.")
    return reserva
