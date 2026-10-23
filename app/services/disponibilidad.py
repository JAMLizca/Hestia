"""Habitaciones disponibles en un rango de fechas (vista del personal)."""
from datetime import date

from sqlalchemy.orm import Session

from app.core.errores import SolicitudInvalida
from app.models.habitacion import Habitacion
from app.services.ocupacion import habitaciones_ocupadas


def consultar(db: Session, fecha_checkin: date, fecha_checkout: date, tipo_habitacion_id: int | None = None) -> list[Habitacion]:
    """
    Una habitación está disponible si:
    1. Su estado operativo no es "mantenimiento".
    2. No tiene ninguna reserva vigente (pendiente, confirmada o en checkin) que se cruce con el rango.
    """
    if fecha_checkout <= fecha_checkin:
        raise SolicitudInvalida("La fecha de checkout debe ser posterior a la de checkin")
    ocupadas = habitaciones_ocupadas(db, fecha_checkin, fecha_checkout)
    consulta = db.query(Habitacion).filter(Habitacion.estado != "mantenimiento")
    if ocupadas:
        consulta = consulta.filter(~Habitacion.id.in_(ocupadas))
    if tipo_habitacion_id:
        consulta = consulta.filter(Habitacion.tipo_habitacion_id == tipo_habitacion_id)
    return consulta.all()
