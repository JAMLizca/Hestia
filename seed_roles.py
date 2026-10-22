import os
from getpass import getpass

import app.db.base  # noqa: F401  (registra todos los modelos)
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.role import Role
from app.models.usuario import Usuario

ROLES_BASE = {
    "administrador": "Acceso total: usuarios, roles, configuración y toda la operación del hotel.",
    "gerente": "Gestiona habitaciones, tipos, servicios y huéspedes; supervisa la operación.",
    "recepcionista": "Atiende reservas, check-in/out, huéspedes, consumos y pagos; solo cambia el estado de las habitaciones.",
}


def seed_roles(db):
    for nombre, descripcion in ROLES_BASE.items():
        existe = db.query(Role).filter(Role.nombre == nombre).first()
        if not existe:
            db.add(Role(nombre=nombre, description=descripcion))
            print(f"Rol creado: {nombre}")
        else:
            if not existe.description:
                existe.description = descripcion
            print(f"Rol ya existe: {nombre}")
    db.commit()


def seed_admin(db):
    rol_admin = db.query(Role).filter(Role.nombre == "administrador").first()
    if db.query(Usuario).filter(Usuario.rol_id == rol_admin.id).first():
        print("Ya existe un administrador")
        return

    nombre = os.getenv("ADMIN_NOMBRE") or input("Nombre del administrador: ").strip()
    email = os.getenv("ADMIN_EMAIL") or input("Email del administrador: ").strip()
    password = os.getenv("ADMIN_PASSWORD") or getpass("Contraseña (mínimo 8 caracteres): ")
    if not nombre or not email or len(password) < 8:
        raise SystemExit("Datos inválidos: nombre y email son obligatorios y la contraseña necesita 8 caracteres")
    if db.query(Usuario).filter(Usuario.email == email).first():
        raise SystemExit(f"Ya existe un usuario con el email {email}")

    db.add(Usuario(nombre=nombre, email=email, password_hash=hash_password(password), rol_id=rol_admin.id))
    db.commit()
    print(f"Administrador creado: {email}")


def seed():
    db = SessionLocal()
    try:
        seed_roles(db)
        seed_admin(db)
    finally:
        db.close()


if __name__ == "__main__":
    seed()