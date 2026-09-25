"""
Script de arranque: insertar los roles base del sistema si no existen.
"""
from app.db.session import SessionLocal
from app.models.role import Role

ROLES_BASE = ["administrador", "gerente", "recepcionista"]


def seed():
    db = SessionLocal()
    try:
        for nombre in ROLES_BASE:
            existe = db.query(Role).filter(Role.nombre == nombre).first()
            if not existe:
                db.add(Role(nombre=nombre))
                print(f"Rol creado: {nombre}")
            else:
                print(f"Rol ya existe: {nombre}")
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed()
from app.db.session import SessionLocal
from app.models.role import Role

ROLES_BASE = ["administrador", "gerente", "recepcionista"]


def seed():
    db = SessionLocal()
    try:
        for nombre in ROLES_BASE:
            existe = db.query(Role).filter(Role.nombre == nombre).first()
            if not existe:
                db.add(Role(nombre=nombre))
                print(f"Rol creado: {nombre}")
            else:
                print(f"Rol ya existe: {nombre}")
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed()