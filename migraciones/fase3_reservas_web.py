import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import inspect, text  # noqa: E402

from app.db.base import Base  # noqa: E402
from app.db.session import engine  # noqa: E402


def main() -> None:
    Base.metadata.create_all(bind=engine)  # tablas nuevas, si las hubiera
    columnas = {c["name"] for c in inspect(engine).get_columns("configuracion_hotel")}
    if "reservas_web_activas" not in columnas:
        with engine.begin() as con:
            con.execute(text("ALTER TABLE configuracion_hotel ADD COLUMN reservas_web_activas BOOLEAN NOT NULL DEFAULT 0"))
        print("configuracion_hotel.reservas_web_activas: agregada (apagada)")
    print("Migración de la Fase 3 lista.")


if __name__ == "__main__":
    main()
