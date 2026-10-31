"""
Exporta desde la base del sistema los dos archivos que usa el entrenamiento (carpeta ml/datos/):

  reservas.csv      una fila por reserva, con el MISMO código del reporte «Dataset de reservas» de la app
                    (app/services/reportes.py). No incluye datos personales de los huéspedes.
  habitaciones.csv  el inventario de habitaciones (tipo, piso, capacidad, camas, m², precio base):
                    se necesita para convertir reservas en «porcentaje de ocupación».

USO:
    DB_NAME=hestia_ml python ml/exportar_dataset.py
    DB_NAME=hestia_ml python ml/exportar_dataset.py --desde 2024-11-01 --hasta 2026-10-31
"""
import argparse
import csv
import sys
from datetime import date
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

import app.db.base  # noqa: E402,F401
from app.db.session import SessionLocal  # noqa: E402
from app.models.habitacion import Habitacion  # noqa: E402
from app.services import reportes  # noqa: E402

DESTINO = RAIZ / "ml" / "datos"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--desde", type=date.fromisoformat, help="fecha de llegada mínima (AAAA-MM-DD)")
    ap.add_argument("--hasta", type=date.fromisoformat, help="fecha de llegada máxima (AAAA-MM-DD)")
    args = ap.parse_args()

    DESTINO.mkdir(parents=True, exist_ok=True)
    db = SessionLocal()
    try:
        print(f"Base de datos: {db.get_bind().url.get_backend_name()}://{db.get_bind().url.host or '-'}/{db.get_bind().url.database}")
        filas = reportes.filas(db, args.desde, args.hasta)
        (DESTINO / "reservas.csv").write_text(reportes.a_csv(filas), encoding="utf-8", newline="")
        print(f"  ml/datos/reservas.csv      {len(filas)} reservas, {len(reportes.COLUMNAS)} columnas")

        habitaciones = db.query(Habitacion).order_by(Habitacion.numero).all()
        with (DESTINO / "habitaciones.csv").open("w", encoding="utf-8", newline="") as f:
            w = csv.writer(f, lineterminator="\n")
            w.writerow(["numero", "piso", "tipo_habitacion", "capacidad_maxima", "camas", "metros_cuadrados", "precio_base"])
            for h in habitaciones:
                t = h.tipo_habitacion
                w.writerow([h.numero, h.piso if h.piso is not None else "", t.nombre, t.capacidad_maxima, t.camas, float(t.metros_cuadrados or 0), float(t.precio_base)])
        print(f"  ml/datos/habitaciones.csv  {len(habitaciones)} habitaciones")
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
