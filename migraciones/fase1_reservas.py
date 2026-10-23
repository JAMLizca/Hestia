import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import inspect, text  # noqa: E402

from app.db.base import Base  # noqa: E402
from app.db.session import engine  # noqa: E402


def columnas(tabla: str) -> set[str]:
    return {c["name"] for c in inspect(engine).get_columns(tabla)}


def indices(tabla: str) -> set[str]:
    return {i["name"] for i in inspect(engine).get_indexes(tabla)}


def main() -> None:
    Base.metadata.create_all(bind=engine)
    es_mysql = engine.dialect.name == "mysql"

    with engine.begin() as con:
        #ereservas
        cols = columnas("reservas")
        if "codigo" not in cols:
            con.execute(text("ALTER TABLE reservas ADD COLUMN codigo VARCHAR(12) NULL"))
            print("reservas.codigo: agregada")
        if "canal" not in cols:
            con.execute(text("ALTER TABLE reservas ADD COLUMN canal VARCHAR(20) NOT NULL DEFAULT 'presencial'"))
            print("reservas.canal: agregada")
        if "notas" not in cols:
            con.execute(text("ALTER TABLE reservas ADD COLUMN notas VARCHAR(500) NULL"))
            print("reservas.notas: agregada")
        if "motivo_cancelacion" not in cols:
            con.execute(text("ALTER TABLE reservas ADD COLUMN motivo_cancelacion VARCHAR(100) NULL"))
            print("reservas.motivo_cancelacion: agregada")

        # Código para las reservas que ya existían
        con.execute(text("UPDATE reservas SET codigo = 'HST-' || SUBSTR('000000' || id, -6) WHERE codigo IS NULL") if not es_mysql
                    else text("UPDATE reservas SET codigo = CONCAT('HST-', LPAD(id, 6, '0')) WHERE codigo IS NULL"))
        if es_mysql:
            con.execute(text("ALTER TABLE reservas MODIFY COLUMN codigo VARCHAR(12) NOT NULL"))
        if "uq_reservas_codigo" not in indices("reservas") and "codigo" not in {
            c for i in inspect(engine).get_unique_constraints("reservas") for c in i["column_names"]
        }:
            con.execute(text("CREATE UNIQUE INDEX uq_reservas_codigo ON reservas (codigo)"))
            print("reservas.codigo: índice único creado")

        #configuración
        if "horas_vencimiento_pendiente" not in columnas("configuracion_hotel"):
            con.execute(text("ALTER TABLE configuracion_hotel ADD COLUMN horas_vencimiento_pendiente INT NOT NULL DEFAULT 24"))
            print("configuracion_hotel.horas_vencimiento_pendiente: agregada")

    print("Migración de la Fase 1 lista.")


if __name__ == "__main__":
    main()
