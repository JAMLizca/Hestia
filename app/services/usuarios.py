"""
Usuarios del personal: alta, edición, contraseñas y eliminación.

Un usuario solo se elimina si nunca dejó rastro (reservas que creó o pre-check-ins que validó); si ya trabajó en
el sistema se desactiva, para no perder quién hizo cada reserva.
"""
from sqlalchemy.orm import Session

from app.core.errores import Conflicto, NoAutenticado, NoEncontrado, Prohibido, SolicitudInvalida
from app.core.security import hash_password, verify_password
from app.models.precheckin import PreCheckin
from app.models.reserva import Reserva
from app.models.role import Role
from app.models.usuario import Usuario
from app.schemas.usuario import PasswordChange, UsuarioCreate, UsuarioPasswordUpdate, UsuarioUpdate
from app.services._comun import confirmar_cambios

ROL_ADMIN = "administrador"
EMAIL_USUARIO_WEB = "reservas-en-linea@hestia.co"  # atribuye las reservas hechas desde la página pública

# Columnas NOT NULL: un null explícito daría error 500 en la base de datos.
CAMPOS_OBLIGATORIOS = ("nombre", "email", "rol_id", "activo")


def obtener(db: Session, usuario_id: int) -> Usuario:
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise NoEncontrado(f"No existe un usuario con id {usuario_id}")
    return usuario


def listar(db: Session) -> list[Usuario]:
    return db.query(Usuario).order_by(Usuario.id).all()


def _otros_admins_activos(db: Session, usuario_id: int) -> int:
    return (
        db.query(Usuario)
        .join(Role, Usuario.rol_id == Role.id)
        .filter(Role.nombre == ROL_ADMIN, Usuario.activo.is_(True), Usuario.id != usuario_id)
        .count()
    )


def crear(db: Session, datos: UsuarioCreate) -> Usuario:
    if db.query(Usuario).filter(Usuario.email == datos.email).first():
        raise SolicitudInvalida("Ya existe un usuario registrado con ese email")
    if not db.query(Role).filter(Role.id == datos.rol_id).first():
        raise SolicitudInvalida(f"El rol con id {datos.rol_id} no existe")
    nuevo = Usuario(nombre=datos.nombre, email=datos.email, password_hash=hash_password(datos.password), rol_id=datos.rol_id)
    db.add(nuevo)
    confirmar_cambios(db)
    db.refresh(nuevo)
    return nuevo


def editar(db: Session, usuario_id: int, datos_in: UsuarioUpdate, actual: Usuario) -> Usuario:
    usuario = obtener(db, usuario_id)
    datos = datos_in.model_dump(exclude_unset=True)

    for campo in CAMPOS_OBLIGATORIOS:
        if campo in datos and datos[campo] is None:
            raise SolicitudInvalida(f"El campo '{campo}' no puede ser nulo")

    if "email" in datos and db.query(Usuario).filter(Usuario.email == datos["email"], Usuario.id != usuario_id).first():
        raise SolicitudInvalida("Ya existe un usuario registrado con ese email")

    nuevo_rol = usuario.rol
    if "rol_id" in datos and datos["rol_id"] != usuario.rol_id:
        nuevo_rol = db.query(Role).filter(Role.id == datos["rol_id"]).first()
        if not nuevo_rol:
            raise SolicitudInvalida(f"El rol con id {datos['rol_id']} no existe")

    # Protecciones para que el sistema nunca se quede sin un administrador con acceso.
    es_propio = usuario.id == actual.id
    if es_propio and datos.get("activo") is False:
        raise SolicitudInvalida("No puedes desactivar tu propia cuenta")
    if es_propio and "rol_id" in datos and datos["rol_id"] != usuario.rol_id:
        raise SolicitudInvalida("No puedes cambiar tu propio rol")

    era_admin_activo = usuario.rol.nombre == ROL_ADMIN and usuario.activo
    seguira_siendo_admin_activo = nuevo_rol.nombre == ROL_ADMIN and datos.get("activo", usuario.activo)
    if era_admin_activo and not seguira_siendo_admin_activo and _otros_admins_activos(db, usuario_id) == 0:
        raise SolicitudInvalida("Debe quedar al menos un administrador activo")

    for campo, valor in datos.items():
        setattr(usuario, campo, valor)
    confirmar_cambios(db)
    db.refresh(usuario)
    return usuario


def eliminar(db: Session, usuario_id: int, actual: Usuario) -> None:
    usuario = obtener(db, usuario_id)
    if usuario.id == actual.id:
        raise SolicitudInvalida("No puedes eliminar tu propia cuenta")
    if usuario.rol.nombre == ROL_ADMIN and usuario.activo and _otros_admins_activos(db, usuario_id) == 0:
        raise SolicitudInvalida("Debe quedar al menos un administrador activo")
    if usuario.email == EMAIL_USUARIO_WEB:
        raise Conflicto("Este usuario del sistema atribuye las reservas en línea y no se puede eliminar")
    reservas = db.query(Reserva).filter(Reserva.usuario_id == usuario_id).count()
    validaciones = db.query(PreCheckin).filter(PreCheckin.validado_por_id == usuario_id).count()
    if reservas or validaciones:
        raise Conflicto(
            f"No se puede eliminar: ya registró {reservas} reserva(s) y validó {validaciones} pre-check-in(s). "
            "Desactívalo para que no pueda entrar y se conserve el historial."
        )
    db.delete(usuario)
    confirmar_cambios(db)


def definir_password(db: Session, usuario_id: int, datos: UsuarioPasswordUpdate) -> None:
    usuario = obtener(db, usuario_id)
    usuario.password_hash = hash_password(datos.password)
    confirmar_cambios(db)


def cambiar_mi_password(db: Session, usuario: Usuario, datos: PasswordChange) -> None:
    """Exige la contraseña actual. Es 400 (y no 401, que el frontend toma como sesión vencida)."""
    if not verify_password(datos.password_actual, usuario.password_hash):
        raise SolicitudInvalida("La contraseña actual no es correcta")
    if datos.password_nueva == datos.password_actual:
        raise SolicitudInvalida("La contraseña nueva debe ser distinta de la actual")
    usuario.password_hash = hash_password(datos.password_nueva)
    confirmar_cambios(db)


def autenticar(db: Session, email: str, password: str) -> Usuario:
    """Devuelve el usuario si las credenciales son correctas y está activo; 401 o 403 si no."""
    usuario = db.query(Usuario).filter(Usuario.email == email).first()
    if not usuario or not verify_password(password, usuario.password_hash):
        raise NoAutenticado("Email o contraseña incorrectos")
    if not usuario.activo:
        raise Prohibido("El usuario está inactivo")
    return usuario
