"""
Enciende (o apaga) las reservas en línea sin pasar por la pantalla de Configuración.

    python migraciones/activar_reservas_web.py          # enciende
    python migraciones/activar_reservas_web.py --apagar # apaga

Es lo mismo que marcar «Permitir reservas en línea» en Configuración y guardar. Requiere haber
corrido antes migraciones/fase3_reservas_web.py (que agrega la columna).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text  # noqa: E402

from app.db.session import engine  # noqa: E402


def main() -> int:
    valor = 0 if "--apagar" in sys.argv else 1
    with engine.begin() as con:
        filas = con.execute(text("SELECT COUNT(*) FROM configuracion_hotel")).scalar()
        if not filas:
            print("Aún no hay configuración guardada: entra a Configuración, guarda una vez y vuelve a ejecutar esto.")
            return 1
        con.execute(text("UPDATE configuracion_hotel SET reservas_web_activas = :v"), {"v": valor})
    print("Reservas en línea:", "ENCENDIDAS" if valor else "APAGADAS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
