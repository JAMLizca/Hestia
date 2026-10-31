"""
Hestia Intelligence: arma las variables de los modelos con los datos VIVOS del hotel y consulta los modelos
(app/ml/prediccion.py). Las variables se calculan igual que en el entrenamiento (ml/paso3_variables.py).

Predicción de ocupación
  Se hace «hoy» para los próximos días (máximo 30). El modelo depende de qué tan lejos esté cada día:
  hasta 7 días usa el modelo de 7, hasta 14 el de 14 y hasta 30 el de 30.
  «En libros» = reservas ya hechas que cubren esa noche, contando también las canceladas (así se contó al
  entrenar: el sistema no guarda cuándo se canceló una reserva).

Recomendación
  El modelo estima qué tipo de habitación suele elegirse con una reserva como esta; luego se descartan los tipos
  que no caben o no están libres y se reparte la afinidad entre los que quedan. Dentro de cada tipo se propone la
  habitación que mejor cumple las preferencias que se pueden comprobar (piso, acceso, cama).
"""
from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.errores import ServicioNoDisponible, SolicitudInvalida
from app.ml.prediccion import ModeloNoDisponible, cargar
from app.models.habitacion import Habitacion
from app.models.reserva import Reserva
from app.models.tipo_habitacion import TipoHabitacion
from app.services import configuracion
from app.services.ocupacion import habitaciones_ocupadas
from app.services.temporada import temporada_para

ESTADOS_DUERMEN = ("checkout", "checkin")  # el huésped realmente se alojó
HORIZONTE_MAXIMO = 30
MAX_SUGERENCIAS = 3


def hoy_hotel(db: Session) -> date:
    """La fecha de hoy en la zona horaria del hotel (el servidor corre en UTC y de noche iría un día adelante)."""
    zona = configuracion.obtener(db).zona_horaria
    try:
        from zoneinfo import ZoneInfo

        return datetime.now(ZoneInfo(zona)).date()
    except Exception:  # sin base de zonas horarias en el sistema
        if zona == "America/Bogota":
            return datetime.now(timezone(timedelta(hours=-5))).date()
        return date.today()


def _modelo(nombre: str):
    try:
        return cargar(nombre)
    except ModeloNoDisponible as e:
        raise ServicioNoDisponible("Los modelos de Hestia Intelligence no están disponibles por ahora.") from e


# =============================================================================================
# PREDICCIÓN DE OCUPACIÓN
# =============================================================================================
def pronosticar_ocupacion(db: Session, desde: date | None, dias: int) -> dict:
    hoy = hoy_hotel(db)
    desde = desde or hoy
    if desde < hoy:
        raise SolicitudInvalida("La fecha inicial no puede ser pasada: el pronóstico mira hacia adelante.")
    ultimo = desde + timedelta(days=dias - 1)
    if (ultimo - hoy).days > HORIZONTE_MAXIMO:
        raise SolicitudInvalida(f"El pronóstico llega hasta {HORIZONTE_MAXIMO} días hacia adelante (hasta el {hoy + timedelta(days=HORIZONTE_MAXIMO)}).")

    n_hab = db.query(func.count(Habitacion.id)).scalar() or 0
    if n_hab == 0:
        raise SolicitudInvalida("No hay habitaciones registradas: no se puede calcular la ocupación.")
    modelos = {7: _modelo("ocupacion_h7"), 14: _modelo("ocupacion_h14"), 30: _modelo("ocupacion_h30")}

    # Noches de cada reserva que caen en la ventana [hoy - 28, último día + 3]
    inicio, fin = hoy - timedelta(days=28), ultimo + timedelta(days=3)
    libros: dict[date, int] = defaultdict(int)     # reservas (cualquier estado) que cubren la noche
    dormidas: dict[date, int] = defaultdict(int)   # habitaciones en que el huésped se alojó
    filas = (
        db.query(Reserva.fecha_checkin_prevista, Reserva.fecha_checkout_prevista, Reserva.estado)
        .filter(Reserva.fecha_checkout_prevista > inicio, Reserva.fecha_checkin_prevista <= fin)
        .all()
    )
    for entrada, salida, estado in filas:
        for i in range(max((inicio - entrada).days, 0), min((salida - entrada).days, (fin - entrada).days + 1)):
            noche = entrada + timedelta(days=i)
            libros[noche] += 1
            if estado in ESTADOS_DUERMEN:
                dormidas[noche] += 1

    # Ritmo de reservas nuevas (por día, como % de las habitaciones)
    creadas = [c.date() for (c,) in db.query(Reserva.fecha_creacion).filter(Reserva.fecha_creacion >= datetime.combine(hoy - timedelta(days=28), time.min)).all() if c]
    nuevas7 = sum(1 for c in creadas if c > hoy - timedelta(days=7)) / 7 / n_hab * 100
    nuevas28 = sum(1 for c in creadas if c > hoy - timedelta(days=28)) / 28 / n_hab * 100

    def ocup_media(dias_atras: int) -> float:
        return sum(dormidas[hoy - timedelta(days=k)] for k in range(1, dias_atras + 1)) / dias_atras / n_hab * 100

    ult7, ult28 = ocup_media(7), ocup_media(28)

    resultado, aciertos, errores = [], [], []
    for i in range(dias):
        d = desde + timedelta(days=i)
        h = (d - hoy).days
        clave = 7 if h <= 7 else 14 if h <= 14 else 30
        modelo = modelos[clave]
        fila = {
            "en_libros_pct": libros[d] / n_hab * 100,
            "en_libros_sem_pct": sum(libros[d + timedelta(days=k)] for k in range(-3, 4)) / 7 / n_hab * 100,
            "nuevas_7d": nuevas7,
            "nuevas_28d": nuevas28,
            "ocup_ult7": ult7,
            "ocup_ult28": ult28,
            "es_finde": int(d.weekday() in (4, 5)),
            "dia_semana": d.weekday(),
            "mes": d.month,
        }
        resultado.append({"fecha": d, "ocupacion_pct": round(modelo.predecir(fila), 1), "horizonte_dias": h})
        aciertos.append(modelo.meta.get("acierto_10pp", 0.0))
        errores.append(modelo.meta.get("mae_prueba_pp", 0.0))

    pico = max(resultado, key=lambda r: r["ocupacion_pct"])
    return {
        "desde": desde,
        "dias": resultado,
        "promedio_pct": round(sum(r["ocupacion_pct"] for r in resultado) / len(resultado), 1),
        "dia_pico": pico["fecha"],
        "dia_pico_pct": pico["ocupacion_pct"],
        "confianza_pct": round(100 * sum(aciertos) / len(aciertos)),
        "error_medio_pp": round(sum(errores) / len(errores), 1),
        "habitaciones": n_hab,
        "entrenado": modelos[7].meta.get("entrenado"),
    }


# =============================================================================================
# RECOMENDACIÓN DE HABITACIONES
# =============================================================================================
def _clave_numero(numero: str):
    """Orden natural: 2 antes que 10, 101 antes que 102."""
    return (0, int(numero), "") if numero.isdigit() else (1, 0, numero)


def _cumple_preferencias(h: Habitacion, tipo: TipoHabitacion, prefs: dict, piso_max: int, piso_min: int) -> list[str]:
    """Preferencias que se pueden comprobar con los datos de la habitación (la vista y la tranquilidad no se guardan)."""
    motivos = []
    if prefs.get("piso") and h.piso is not None and piso_max > piso_min:
        corte = (piso_min + piso_max) // 2  # con pisos 1 a 4: bajo = 1-2, alto = 3-4
        if prefs["piso"] == "bajo" and h.piso <= corte:
            motivos.append("Piso bajo (preferencia indicada)")
        if prefs["piso"] == "alto" and h.piso > corte:
            motivos.append("Piso alto (preferencia indicada)")
    if prefs.get("accesible") and h.piso is not None and h.piso == piso_min:
        motivos.append("Primer piso: acceso más fácil")
    if prefs.get("cama") == "doble" and tipo.camas == 1:
        motivos.append("Cama doble (preferencia indicada)")
    if prefs.get("cama") == "sencillas" and tipo.camas >= 2:
        motivos.append("Camas sencillas (preferencia indicada)")
    return motivos


def recomendar(db: Session, llegada: date, salida: date, huespedes: int, preferencias: dict, canal: str, por_habitacion: bool) -> list[dict]:
    hoy = hoy_hotel(db)
    if llegada < hoy:
        raise SolicitudInvalida("La fecha de llegada no puede ser pasada.")
    if salida <= llegada:
        raise SolicitudInvalida("La fecha de salida debe ser posterior a la de llegada.")
    modelo = _modelo("recomendador")

    ocupadas = habitaciones_ocupadas(db, llegada, salida)
    todas = db.query(Habitacion).filter(Habitacion.estado != "mantenimiento").all()
    pisos = [h.piso for h in db.query(Habitacion).all() if h.piso is not None]
    piso_min, piso_max = (min(pisos), max(pisos)) if pisos else (0, 0)
    libres = [h for h in todas if h.id not in ocupadas]
    tipos = {t.id: t for t in db.query(TipoHabitacion).filter(TipoHabitacion.capacidad_maxima >= huespedes).all()}
    por_tipo: dict[int, list[Habitacion]] = defaultdict(list)
    for h in libres:
        if h.tipo_habitacion_id in tipos:
            por_tipo[h.tipo_habitacion_id].append(h)
    if not por_tipo:
        return []

    fila = {
        "num_huespedes": huespedes,
        "noches": (salida - llegada).days,
        "anticipacion_dias": (llegada - hoy).days,
        "canal": canal,
        "temporada": temporada_para(llegada),
        "dia_semana_llegada": llegada.weekday(),
        "mes_llegada": llegada.month,
        "llegada_fin_de_semana": int(llegada.weekday() in (4, 5)),
        "huesped_recurrente": 0,
        "reservas_previas_huesped": 0,
        "extranjero": 0,
        "pref_piso": preferencias.get("piso") or "sin_preferencia",
        "pref_vista": preferencias.get("vista") or "sin_preferencia",
        "pref_cama": preferencias.get("cama") or "sin_preferencia",
        "pref_tranquila": int(bool(preferencias.get("tranquila"))),
        "pref_accesible": int(bool(preferencias.get("accesible"))),
    }
    probs = modelo.probabilidades(fila)
    pesos = {tid: probs.get(tipos[tid].nombre, 0.0) for tid in por_tipo}  # un tipo que el modelo no conoce pesa 0
    total = sum(pesos.values())
    if total <= 0:
        return []

    orden = sorted(por_tipo, key=lambda tid: pesos[tid], reverse=True)[:MAX_SUGERENCIAS]
    precios = {tid: tipos[tid].precio_base for tid in orden}
    mas_barato = min(precios, key=precios.get) if len(orden) > 1 else None

    resultado = []
    for rango, tid in enumerate(orden):
        t = tipos[tid]
        candidatas = sorted(por_tipo[tid], key=lambda h: _clave_numero(h.numero))
        puntuadas = [(len(_cumple_preferencias(h, t, preferencias, piso_max, piso_min)), h) for h in candidatas]
        mejor_n, mejor = max(puntuadas, key=lambda x: x[0])  # empata → la de número menor (el primero que aparece)
        motivos = []
        if rango == 0:
            motivos.append("La más elegida con reservas parecidas a esta")
        motivos.append(f"Capacidad para {t.capacidad_maxima} personas (grupo de {huespedes})")
        motivos.extend(_cumple_preferencias(mejor, t, preferencias, piso_max, piso_min))
        if tid == mas_barato:
            motivos.append("La opción más económica entre las sugeridas")
        resultado.append(
            {
                "tipo_habitacion_id": tid,
                "tipo": t.nombre,
                "habitacion_id": mejor.id if por_habitacion else None,
                "numero": mejor.numero if por_habitacion else None,
                "piso": mejor.piso if por_habitacion else None,
                "precio_noche": float(t.precio_base if isinstance(t.precio_base, Decimal) else Decimal(str(t.precio_base))),
                "afinidad_pct": round(100 * pesos[tid] / total),
                "motivos": motivos,
                "disponibles": len(candidatas),
            }
        )
    return resultado
