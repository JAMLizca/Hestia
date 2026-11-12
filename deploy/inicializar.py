import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import os  # noqa: E402

from dotenv import load_dotenv  # noqa: E402

from app.db.base import Base  # noqa: E402
from app.db.session import SessionLocal, engine  # noqa: E402
from seed_roles import seed_admin, seed_roles  # noqa: E402


def main() -> int:
    # os.getenv no lee el .env por sí solo: sin esto, los ADMIN_* definidos ahí se ignoran.
    load_dotenv()
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
