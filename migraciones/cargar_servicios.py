"""
Carga un catálogo inicial de servicios del hotel (idempotente: omite los que ya existen por nombre).

    python migraciones/cargar_servicios.py --ver     # solo muestra qué haría
    python migraciones/cargar_servicios.py           # crea los que falten

Usa la conexión del `.env` (tu MySQL local, o Aiven con las variables DB_* en la línea de comandos).
No modifica ni borra los servicios existentes. Los precios (COP) son una referencia: ajústalos después
desde Servicios → Catálogo. Las categorías coinciden con las del formulario (cada una tiene su color).
"""
import sys
import unicodedata
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db.session import SessionLocal  # noqa: E402
from app.models.servicio import Servicio  # noqa: E402

# (categoría, nombre, descripción, precio en COP)
SERVICIOS = [
    # ── Alimentos ──────────────────────────────────────────────
    ("Alimentos", "Desayuno buffet", "Buffet con frutas, huevos al gusto, arepas, pan, cereales, jugos naturales y café. Se sirve de 6:30 a 10:00 a. m.", 28000),
    ("Alimentos", "Desayuno en la habitación", "Desayuno americano servido en la habitación a la hora que elijas (de 6:30 a 10:30 a. m.).", 35000),
    ("Alimentos", "Almuerzo ejecutivo", "Sopa del día, plato fuerte con proteína, acompañamientos, jugo y postre.", 38000),
    ("Alimentos", "Cena a la carta", "Plato fuerte a elegir del menú del restaurante, con bebida sin alcohol incluida.", 55000),
    ("Alimentos", "Menú infantil", "Porción pensada para niños: plato principal, jugo y postre.", 25000),
    ("Alimentos", "Snack nocturno", "Sándwich o pasabocas con bebida, disponible hasta la medianoche.", 18000),
    ("Alimentos", "Bandeja de frutas", "Selección de frutas frescas de la región para compartir.", 22000),
    ("Alimentos", "Gaseosa o agua", "Bebida fría a elección: gaseosa, agua con o sin gas.", 5000),
    ("Alimentos", "Café o chocolate caliente", "Café de origen huilense o chocolate caliente, servido en el restaurante o en la habitación.", 6000),
    ("Alimentos", "Cerveza nacional", "Cerveza nacional bien fría (botella).", 9000),
    ("Alimentos", "Cóctel de la casa", "Cóctel de autor preparado en el bar del hotel.", 24000),
    ("Alimentos", "Botella de vino de la casa", "Botella de vino tinto o blanco seleccionado por el hotel.", 95000),
    # ── Lavandería ─────────────────────────────────────────────
    ("Lavandería", "Lavado por prenda", "Lavado y secado de una prenda. Entrega en 24 horas.", 8000),
    ("Lavandería", "Planchado por prenda", "Planchado de una prenda, listo en el mismo día si se entrega antes de las 10:00 a. m.", 5000),
    ("Lavandería", "Lavado en seco por prenda", "Lavado en seco para prendas delicadas, trajes y vestidos. Entrega en 48 horas.", 15000),
    ("Lavandería", "Lavandería por kilo", "Lavado, secado y doblado de ropa por kilo. Entrega en 24 horas.", 14000),
    ("Lavandería", "Lavandería express", "Servicio el mismo día para una bolsa de ropa (hasta 3 kg) entregada antes de las 9:00 a. m.", 45000),
    # ── Habitación ─────────────────────────────────────────────
    ("Habitación", "Cama adicional", "Cama plegable con ropa de cama completa, por noche (sujeto a disponibilidad y capacidad de la habitación).", 60000),
    ("Habitación", "Cuna para bebé", "Cuna con colchón y sábanas, por noche.", 25000),
    ("Habitación", "Salida tardía (late check-out)", "Salida hasta las 6:00 p. m. en lugar del mediodía (sujeto a disponibilidad).", 50000),
    ("Habitación", "Llegada anticipada (early check-in)", "Ingreso desde las 9:00 a. m. en lugar de la hora habitual (sujeto a disponibilidad).", 40000),
    ("Habitación", "Decoración romántica", "Pétalos, velas y detalle de bienvenida para aniversarios o celebraciones. Pídela con 24 horas de anticipación.", 120000),
    ("Habitación", "Limpieza adicional", "Una segunda limpieza de la habitación en el día.", 20000),
    ("Habitación", "Kit de aseo adicional", "Cepillo, crema dental, jabón, champú y peinilla.", 10000),
    ("Habitación", "Tarifa por mascota", "Cargo por noche por mascota pequeña (hasta 10 kg), con cama y platos de bienvenida.", 50000),
    # ── Transporte ─────────────────────────────────────────────
    ("Transporte", "Traslado aeropuerto Benito Salas", "Traslado privado entre el hotel y el aeropuerto Benito Salas de Neiva (un trayecto).", 45000),
    ("Transporte", "Traslado terminal de transporte", "Traslado privado entre el hotel y la terminal de transporte de Neiva (un trayecto).", 25000),
    ("Transporte", "Vehículo con conductor (por hora)", "Carro con conductor para diligencias o recorridos por la ciudad, por hora.", 70000),
    ("Transporte", "Parqueadero cubierto", "Cupo de parqueadero cubierto y vigilado, por noche.", 15000),
    # ── Bienestar ──────────────────────────────────────────────
    ("Bienestar", "Masaje relajante (60 min)", "Masaje de cuerpo completo con aceites esenciales para liberar el estrés.", 120000),
    ("Bienestar", "Masaje descontracturante (60 min)", "Masaje de presión media a profunda para espalda, cuello y hombros.", 140000),
    ("Bienestar", "Circuito de spa", "Acceso por día a sauna, turco y jacuzzi.", 50000),
    ("Bienestar", "Manicure y pedicure", "Manicure y pedicure con esmaltado tradicional.", 45000),
    ("Bienestar", "Clase de yoga matutina", "Clase grupal guiada de 60 minutos frente a la piscina, por persona.", 25000),
    ("Bienestar", "Pase de piscina para visitantes", "Acceso a la piscina por el día para un acompañante que no se aloja en el hotel.", 30000),
    # ── Actividades ────────────────────────────────────────────
    ("Actividades", "Tour Desierto de la Tatacoa", "Excursión de día completo al Desierto de la Tatacoa con guía, transporte y refrigerio. Precio por persona.", 220000),
    ("Actividades", "Tour San Agustín", "Excursión de día completo al Parque Arqueológico de San Agustín con guía y transporte. Precio por persona.", 260000),
    ("Actividades", "Paseo en lancha por Betania", "Recorrido en lancha por la represa de Betania con almuerzo típico. Precio por persona.", 130000),
    ("Actividades", "Cabalgata ecológica", "Recorrido guiado a caballo de dos horas por senderos cercanos. Precio por persona.", 90000),
    ("Actividades", "Tour gastronómico de Neiva", "Recorrido de medio día probando platos típicos huilenses con guía. Precio por persona.", 85000),
    ("Actividades", "Alquiler de bicicleta (día)", "Bicicleta con casco y candado, por día.", 35000),
]


def _clave(texto: str) -> str:
    """Nombre en minúsculas y sin tildes, para no duplicar por mayúsculas o acentos."""
    base = unicodedata.normalize("NFD", texto)
    return "".join(c for c in base if unicodedata.category(c) != "Mn").lower().strip()


def main() -> int:
    solo_ver = "--ver" in sys.argv
    db = SessionLocal()
    try:
        existentes = {_clave(n) for (n,) in db.query(Servicio.nombre).all()}
        creados = 0
        for categoria, nombre, descripcion, precio in SERVICIOS:
            if _clave(nombre) in existentes:
                print(f"  ya existe   {nombre}")
                continue
            precio_txt = f"{precio:,}".replace(",", ".")
            print(f"  {'crearía' if solo_ver else 'creado '}    [{categoria}] {nombre}  (${precio_txt})")
            if not solo_ver:
                db.add(Servicio(nombre=nombre, descripcion=descripcion, precio=Decimal(precio), categoria=categoria))
            creados += 1
        if not solo_ver:
            db.commit()
        print(f"Listo: {creados} servicio(s) {'por crear' if solo_ver else 'creado(s)'}.")
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
