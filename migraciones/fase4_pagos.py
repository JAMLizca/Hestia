import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import inspect, text  # noqa: E402

from app.db.base import Base  # noqa: E402
from app.db.session import engine  # noqa: E402


def columnas(tabla: str) -> set[str]:
    return {c["name"] for c in inspect(engine).get_columns(tabla)}


def main() -> None:
    Base.metadata.create_all(bind=engine)  # tablas nuevas, si las hubiera
    with engine.begin() as con:
        cols = columnas("pagos")
        if "referencia" not in cols:
            con.execute(text("ALTER TABLE pagos ADD COLUMN referencia VARCHAR(64) NULL"))
            con.execute(text("CREATE UNIQUE INDEX uq_pagos_referencia ON pagos (referencia)"))
            print("pagos.referencia: agregada (con índice único)")
        if "transaccion_id" not in cols:
            con.execute(text("ALTER TABLE pagos ADD COLUMN transaccion_id VARCHAR(64) NULL"))
            print("pagos.transaccion_id: agregada")
        if "anticipo_porcentaje" not in columnas("configuracion_hotel"):
            con.execute(text("ALTER TABLE configuracion_hotel ADD COLUMN anticipo_porcentaje INT NOT NULL DEFAULT 0"))
            print("configuracion_hotel.anticipo_porcentaje: agregada (0 = sin pago en línea)")
    print("Migración de la Fase 4 lista.")


if __name__ == "__main__":
    main()
