"""
La fecha «de hoy» según la zona horaria del hotel, no la del servidor.

El servidor suele correr en UTC (Render, por ejemplo). En Colombia eso significa
que a partir de las 7 p. m. el servidor ya está en el día siguiente: sin esto,
recepción no podría crear una reserva para esa misma noche porque la fecha de
llegada parecería estar en el pasado.

Lee el modelo directamente, y no el servicio de configuración, para que
cualquier servicio pueda importarlo sin riesgo de importaciones circulares.
"""
from datetime import date, datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.configuracion import CONFIG_ID, ConfiguracionHotel

ZONA_POR_DEFECTO = "America/Bogota"
# Respaldo si el sistema no trae la base de datos de zonas horarias (imagen mínima).
DESFASES = {"America/Bogota": -5, "America/Lima": -5, "America/Mexico_City": -6, "UTC": 0}


def zona_del_hotel(db: Session) -> str:
    config = db.get(ConfiguracionHotel, CONFIG_ID)
    return (config.zona_horaria if config and config.zona_horaria else ZONA_POR_DEFECTO)


def ahora_hotel(db: Session) -> datetime:
    zona = zona_del_hotel(db)
    try:
        from zoneinfo import ZoneInfo

        return datetime.now(ZoneInfo(zona))
    except Exception:
        return datetime.now(timezone(timedelta(hours=DESFASES.get(zona, 0))))


def hoy_hotel(db: Session) -> date:
    return ahora_hotel(db).date()
