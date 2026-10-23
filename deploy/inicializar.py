"""
Prepara la base de datos al arrancar (idempotente: se puede correr en cada despliegue).

  1. Crea las tablas que falten (incluye todas las restricciones CHECK y UNIQUE de los modelos).
  2. Crea los roles base.
  3. Si todavía no hay administrador y están definidas ADMIN_NOMBRE, ADMIN_EMAIL y ADMIN_PASSWORD, lo crea.

Solo sirve para una base NUEVA o ya al día. Una base con datos de una versión anterior necesita
las migraciones de la carpeta `migraciones/`, en orden.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import os  # noqa: E402

from app.db.base import Base  # noqa: E402
from app.db.session import SessionLocal, engine  # noqa: E402
from seed_roles import seed_admin, seed_roles  # noqa: E402


def main() -> int:
    Base.metadata.create_all(bind=engine)
    print("Tablas listas.")
    db = SessionLocal()
    try:
        seed_roles(db)
        if all(os.getenv(k) for k in ("ADMIN_NOMBRE", "ADMIN_EMAIL", "ADMIN_PASSWORD")):
            seed_admin(db)
        else:
            print("ADMIN_NOMBRE / ADMIN_EMAIL / ADMIN_PASSWORD sin definir: no se crea administrador.")
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
