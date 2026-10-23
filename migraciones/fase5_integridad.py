"""
Hestia · Fase 5 (integridad en la base de datos, CRUD completo y datos para ML): migración.

Agrega, sobre una base que ya existía:
  - reservas.temporada (alta|media|baja) y reservas.preferencias (JSON)       → RF-20
  - pagos.motivo_anulacion                                                     → RF-16
  - la tabla reserva_noches (una fila por habitación y noche ocupada) con su restricción UNIQUE:
    es lo que impide en la base de datos que dos reservas ocupen la misma habitación la misma noche → RNF-10
  - las restricciones CHECK de estados, fechas, cantidades y montos de cada tabla                   → RNF-10

Qué hace con los datos que ya hay:
  - temporada: se calcula para cada reserva existente según su fecha de llegada.
  - reserva_noches: se llena con las reservas vigentes (pendiente, confirmada, checkin). Si dos reservas
    vigentes ya se solapaban, la segunda NO se bloquea y se lista para que recepción la corrija.
  - CHECK: antes de agregar cada una se verifica que ninguna fila existente la incumpla; si alguna lo hace,
    esa restricción se omite y se muestran las filas para corregirlas.

Es idempotente: se puede ejecutar varias veces; solo agrega lo que falta. Si quedó algo pendiente termina con
código 1: corrige esos datos y vuelve a ejecutarlo. Usa la conexión del `.env`.

    python migraciones/fase5_integridad.py       (desde la carpeta raíz del proyecto, con el entorno virtual activo)

Requiere haber aplicado antes las migraciones de las Fases 1, 3 y 4 y MySQL 8.0.16+ o MariaDB 10.2+
(las versiones anteriores aceptan las restricciones CHECK pero no las aplican).
HAZ UNA COPIA DE LA BASE DE DATOS ANTES DE EJECUTARLO.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import CheckConstraint, inspect, text  # noqa: E402
from sqlalchemy.exc import IntegrityError  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.db.base import Base  # noqa: E402
from app.db.session import engine  # noqa: E402
from app.models.reserva import Reserva  # noqa: E402
from app.models.reserva_noche import ReservaNoche  # noqa: E402
from app.services.ocupacion import ESTADOS_QUE_BLOQUEAN, noches_de  # noqa: E402
from app.services.temporada import temporada_para  # noqa: E402

pendientes: list[str] = []


def columnas(tabla: str) -> set[str]:
    return {c["name"] for c in inspect(engine).get_columns(tabla)}


def agregar_columnas() -> bool:
    """Devuelve True si `reservas.temporada` se acaba de crear (hay que rellenarla)."""
    temporada_nueva = False
    with engine.begin() as con:
        cols = columnas("reservas")
        if "temporada" not in cols:
            con.execute(text("ALTER TABLE reservas ADD COLUMN temporada VARCHAR(10) NOT NULL DEFAULT 'baja'"))
            print("reservas.temporada: agregada")
            temporada_nueva = True
        if "preferencias" not in cols:
            con.execute(text("ALTER TABLE reservas ADD COLUMN preferencias JSON NULL"))
            print("reservas.preferencias: agregada")
        if "motivo_anulacion" not in columnas("pagos"):
            con.execute(text("ALTER TABLE pagos ADD COLUMN motivo_anulacion VARCHAR(200) NULL"))
            print("pagos.motivo_anulacion: agregada")
    return temporada_nueva


def rellenar_temporada() -> None:
    with Session(engine) as db:
        por_temporada: dict[str, list[int]] = {}
        for id_, fecha in db.query(Reserva.id, Reserva.fecha_checkin_prevista).all():
            por_temporada.setdefault(temporada_para(fecha), []).append(id_)
        for temporada, ids in por_temporada.items():
            for i in range(0, len(ids), 500):
                db.query(Reserva).filter(Reserva.id.in_(ids[i : i + 500])).update({Reserva.temporada: temporada}, synchronize_session=False)
        db.commit()
        print(f"reservas.temporada: calculada para {sum(len(v) for v in por_temporada.values())} reserva(s) " + str({k: len(v) for k, v in por_temporada.items()}))


def rellenar_noches() -> None:
    with Session(engine) as db:
        con_noches = {r[0] for r in db.query(ReservaNoche.reserva_id).distinct()}
        vigentes = (
            db.query(Reserva)
            .filter(Reserva.estado.in_(ESTADOS_QUE_BLOQUEAN))
            .order_by(Reserva.fecha_creacion, Reserva.id)  # si hay solapamientos, gana la reserva más antigua
            .all()
        )
        nuevas = 0
        for reserva in vigentes:
            if reserva.id in con_noches:
                continue
            try:
                with db.begin_nested():
                    for habitacion_id, fecha in sorted(noches_de(reserva)):
                        db.add(ReservaNoche(reserva_id=reserva.id, habitacion_id=habitacion_id, fecha=fecha))
                    db.flush()
                nuevas += 1
            except IntegrityError:
                pendientes.append(
                    f"La reserva {reserva.codigo} (habitación {reserva.habitacion_id}, {reserva.fecha_checkin_prevista} → "
                    f"{reserva.fecha_checkout_prevista}, {reserva.estado}) se solapa con otra reserva vigente: no quedó bloqueada. "
                    "Cámbiala de habitación o de fechas, o cancélala, y vuelve a ejecutar este script."
                )
        db.commit()
        print(f"reserva_noches: {nuevas} reserva(s) vigente(s) registradas")


def agregar_restricciones() -> None:
    inspector = inspect(engine)
    if engine.dialect.name not in ("mysql", "mariadb"):
        print(f"CHECK: el motor '{engine.dialect.name}' no admite agregarlas a una tabla existente; se omiten.")
        return
    agregadas = 0
    for tabla in Base.metadata.sorted_tables:
        existentes = {c["name"] for c in inspector.get_check_constraints(tabla.name)}
        for c in tabla.constraints:
            if not isinstance(c, CheckConstraint) or not c.name or c.name in existentes:
                continue
            expr = str(c.sqltext)
            with engine.begin() as con:
                malas = con.execute(text(f"SELECT id FROM {tabla.name} WHERE NOT ({expr}) LIMIT 5")).fetchall()
                if malas:
                    pendientes.append(
                        f"{c.name} ({tabla.name}: {expr}) no se agregó porque estas filas la incumplen (ids): {[m[0] for m in malas]}. "
                        "Corrígelas y vuelve a ejecutar."
                    )
                    continue
                con.execute(text(f"ALTER TABLE {tabla.name} ADD CONSTRAINT {c.name} CHECK ({expr})"))
                agregadas += 1
    print(f"CHECK: {agregadas} restricción(es) agregada(s)")


def main() -> int:
    Base.metadata.create_all(bind=engine)  # crea reserva_noches (y cualquier tabla nueva)
    if agregar_columnas():
        rellenar_temporada()
    rellenar_noches()
    agregar_restricciones()
    if pendientes:
        print("\nATENCIÓN · quedó pendiente (la migración es parcial hasta corregirlo):")
        for p in pendientes:
            print(" -", p)
        return 1
    print("Migración de la Fase 5 lista.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
