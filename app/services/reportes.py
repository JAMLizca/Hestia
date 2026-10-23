"""
Dataset de reservas para analítica y Machine Learning (RF-20).

Una fila por reserva, con variables ya derivadas (noches, anticipación, temporada, preferencias, recurrencia…) y
las dos etiquetas que interesa predecir (`cancelada`, `no_show`). No incluye datos personales: ni nombre,
documento, correo ni teléfono del huésped.
"""
import csv
import io
from datetime import date

from sqlalchemy.orm import Session, joinedload, selectinload

from app.core.errores import SolicitudInvalida
from app.models.habitacion import Habitacion
from app.models.reserva import Reserva
from app.services import facturacion

COLUMNAS = (
    "reserva_codigo", "canal", "estado", "temporada",
    "fecha_creacion", "fecha_checkin", "fecha_checkout", "noches", "anticipacion_dias",
    "dia_semana_llegada", "mes_llegada", "llegada_fin_de_semana", "num_huespedes",
    "tipo_habitacion", "piso", "precio_noche", "precio_total", "costo_servicios", "total_pagado", "pagado_completo",
    "huesped_nacionalidad", "huesped_recurrente", "reservas_previas_huesped",
    "pref_piso", "pref_vista", "pref_cama", "pref_tranquila", "pref_accesible",
    "cancelada", "no_show",
)

ESTADOS_CERRADOS = ("checkout", "cancelada", "no_show")


def _numero(valor) -> float:
    return float(valor) if valor is not None else 0.0


def filas(db: Session, desde: date | None = None, hasta: date | None = None, solo_cerradas: bool = False) -> list[dict]:
    """Reservas con fecha de llegada entre `desde` y `hasta` (ambas inclusive)."""
    if desde and hasta and hasta < desde:
        raise SolicitudInvalida("'hasta' no puede ser anterior a 'desde'")

    # Cuántas reservas tenía el huésped antes de cada una (en orden de creación): su "recurrencia".
    previas: dict[int, int] = {}
    contador: dict[int, int] = {}
    for reserva_id, huesped_id in db.query(Reserva.id, Reserva.huesped_id).order_by(Reserva.fecha_creacion, Reserva.id).all():
        previas[reserva_id] = contador.get(huesped_id, 0)
        contador[huesped_id] = contador.get(huesped_id, 0) + 1

    consulta = db.query(Reserva).options(
        joinedload(Reserva.huesped), joinedload(Reserva.habitacion).joinedload(Habitacion.tipo_habitacion),
        selectinload(Reserva.pagos), selectinload(Reserva.reserva_servicios),
    )
    if desde:
        consulta = consulta.filter(Reserva.fecha_checkin_prevista >= desde)
    if hasta:
        consulta = consulta.filter(Reserva.fecha_checkin_prevista <= hasta)
    if solo_cerradas:
        consulta = consulta.filter(Reserva.estado.in_(ESTADOS_CERRADOS))

    resultado = []
    for r in consulta.order_by(Reserva.fecha_checkin_prevista, Reserva.id).all():
        noches = (r.fecha_checkout_prevista - r.fecha_checkin_prevista).days
        creada = r.fecha_creacion.date() if r.fecha_creacion else None
        pref = r.preferencias or {}
        pagado = facturacion.total_pagado(r)
        total = facturacion.costo_total(r)
        resultado.append({
            "reserva_codigo": r.codigo,
            "canal": r.canal,
            "estado": r.estado,
            "temporada": r.temporada,
            "fecha_creacion": creada.isoformat() if creada else "",
            "fecha_checkin": r.fecha_checkin_prevista.isoformat(),
            "fecha_checkout": r.fecha_checkout_prevista.isoformat(),
            "noches": noches,
            "anticipacion_dias": (r.fecha_checkin_prevista - creada).days if creada else "",
            "dia_semana_llegada": r.fecha_checkin_prevista.weekday(),  # 0 = lunes … 6 = domingo
            "mes_llegada": r.fecha_checkin_prevista.month,
            "llegada_fin_de_semana": int(r.fecha_checkin_prevista.weekday() in (4, 5)),  # viernes o sábado
            "num_huespedes": r.num_huespedes,
            "tipo_habitacion": r.habitacion.tipo_habitacion.nombre,
            "piso": r.habitacion.piso if r.habitacion.piso is not None else "",
            "precio_noche": round(_numero(r.precio_total) / noches, 2) if noches else "",
            "precio_total": _numero(r.precio_total),
            "costo_servicios": _numero(facturacion.costo_servicios(r)),
            "total_pagado": _numero(pagado),
            "pagado_completo": int(total > 0 and pagado >= total),
            "huesped_nacionalidad": r.huesped.nacionalidad or "",
            "huesped_recurrente": int(previas.get(r.id, 0) > 0),
            "reservas_previas_huesped": previas.get(r.id, 0),
            "pref_piso": pref.get("piso", ""),
            "pref_vista": pref.get("vista", ""),
            "pref_cama": pref.get("cama", ""),
            "pref_tranquila": int(bool(pref.get("tranquila"))),
            "pref_accesible": int(bool(pref.get("accesible"))),
            "cancelada": int(r.estado == "cancelada"),
            "no_show": int(r.estado == "no_show"),
        })
    return resultado


def a_csv(datos: list[dict]) -> str:
    salida = io.StringIO()
    escritor = csv.DictWriter(salida, fieldnames=COLUMNAS, lineterminator="\n")
    escritor.writeheader()
    escritor.writerows(datos)
    return salida.getvalue()
