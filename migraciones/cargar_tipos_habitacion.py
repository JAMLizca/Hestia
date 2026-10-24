"""
Carga un catálogo inicial de tipos de habitación (idempotente: omite los que ya existen por nombre).

    python migraciones/cargar_tipos_habitacion.py --ver     # solo muestra qué haría
    python migraciones/cargar_tipos_habitacion.py           # crea los que falten

Usa la conexión del `.env` (tu MySQL local, o Aiven si tienes sus datos en el `.env`). No toca los tipos
ni las habitaciones existentes. Los precios son una referencia: ajústalos después desde Habitaciones → Tipos.
"""
import sys
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db.session import SessionLocal  # noqa: E402
from app.models.tipo_habitacion import TipoHabitacion  # noqa: E402

# (nombre, descripción, capacidad, camas, m², precio por noche)
TIPOS = [
    ("Habitación Estándar", "Habitación cómoda y luminosa con cama doble, aire acondicionado, TV por cable, escritorio y baño privado con agua caliente. Ideal para viajeros de negocios o parejas.", 2, 1, 22, 180000),
    ("Habitación Doble Twin", "Dos camas sencillas, aire acondicionado, TV, escritorio y baño privado. Pensada para amigos, colegas o familiares que prefieren camas separadas.", 2, 2, 24, 190000),
    ("Habitación Superior", "Espacio amplio con cama king, zona de estar, minibar, TV de pantalla plana, aire acondicionado y baño con ducha de lluvia. Vista a la ciudad.", 2, 1, 30, 250000),
    ("Habitación Triple", "Una cama doble y una sencilla, aire acondicionado, TV y baño privado. Perfecta para viajar en grupo o con un niño.", 3, 2, 30, 270000),
    ("Suite Junior", "Dormitorio con cama king y sala integrada con sofá, escritorio amplio, minibar, cafetera, TV de 50\", aire acondicionado y baño con tina. Un espacio de descanso y trabajo.", 3, 1, 38, 340000),
    ("Suite Ejecutiva", "Dormitorio independiente con cama king, sala con mesa de reuniones para cuatro, escritorio, minibar, cafetera, caja fuerte, TV de 55\" y baño con ducha de lluvia. Pensada para estadías de trabajo.", 2, 1, 45, 420000),
    ("Suite Familiar", "Dos dormitorios conectados (uno con cama king y otro con dos camas sencillas), sala, nevera pequeña, dos televisores y dos baños. Pensada para familias que quieren privacidad sin separarse.", 5, 3, 60, 520000),
    ("Suite Presidencial", "Nuestro mayor espacio: dormitorio principal con cama king, sala, comedor, cocineta, terraza privada, tina de hidromasaje y servicio de bienvenida. Para ocasiones especiales.", 4, 2, 85, 750000),
]


def main() -> int:
    solo_ver = "--ver" in sys.argv
    db = SessionLocal()
    try:
        existentes = {n.lower() for (n,) in db.query(TipoHabitacion.nombre).all()}
        creados = 0
        for nombre, descripcion, capacidad, camas, m2, precio in TIPOS:
            if nombre.lower() in existentes:
                print(f"  ya existe   {nombre}")
                continue
            precio_txt = f"{precio:,}".replace(",", ".")
            print(f"  {'crearía' if solo_ver else 'creado '}    {nombre}  ({capacidad} personas, ${precio_txt})")
            if not solo_ver:
                db.add(TipoHabitacion(nombre=nombre, descripcion=descripcion, capacidad_maxima=capacidad, camas=camas, metros_cuadrados=Decimal(m2), precio_base=Decimal(precio)))
            creados += 1
        if not solo_ver:
            db.commit()
        print(f"Listo: {creados} tipo(s) {'por crear' if solo_ver else 'creado(s)'}.")
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
