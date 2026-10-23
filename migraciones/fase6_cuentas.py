"""
Hestia · Fase 6 (cuentas de huésped): migración de la base de datos.

Agrega:
  - la tabla cuentas_huesped (quienes reservan en línea con su propia cuenta)
  - reservas.cuenta_id (a qué cuenta pertenece una reserva hecha en línea; NULL en las demás)

Es idempotente: se puede ejecutar varias veces y solo agrega lo que falta. Usa la conexión del `.env`.

    python migraciones/fase6_cuentas.py       (desde la carpeta raíz del proyecto, con el entorno virtual activo)

Haz una copia de la base antes de correrla. Requiere haber aplicado antes las migraciones de las fases anteriores.
Las reservas en línea que ya existen quedan sin cuenta (cuenta_id NULL): se siguen consultando con su código y documento.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import inspect, text  # noqa: E402

from app.db.base import Base  # noqa: E402
from app.db.session import engine  # noqa: E402


def main() -> None:
    insp = inspect(engine)
    if "cuentas_huesped" not in insp.get_table_names():
        Base.metadata.tables["cuentas_huesped"].create(bind=engine)
        print("cuentas_huesped: tabla creada")
    cols = {c["name"] for c in inspect(engine).get_columns("reservas")}
    if "cuenta_id" not in cols:
        with engine.begin() as con:
            con.execute(text("ALTER TABLE reservas ADD COLUMN cuenta_id INT NULL"))
            con.execute(text("CREATE INDEX ix_reservas_cuenta_id ON reservas (cuenta_id)"))
            con.execute(text("ALTER TABLE reservas ADD CONSTRAINT fk_reservas_cuenta FOREIGN KEY (cuenta_id) REFERENCES cuentas_huesped (id)"))
        print("reservas.cuenta_id: agregada (con índice y llave foránea)")
    print("Migración de la Fase 6 lista.")


if __name__ == "__main__":
    main()
