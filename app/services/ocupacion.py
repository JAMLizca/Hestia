"""
Mantiene `reserva_noches` sincronizada con las reservas (ver app/models/reserva_noche.py).

Se engancha al `flush` de SQLAlchemy: cada vez que una reserva se crea, cambia de estado, de fechas o de
habitación, o se elimina, sus noches se recalculan en la misma transacción. Así ningún camino del código
(rutas, pago en línea, reactivación de una reserva vencida…) puede olvidarse de bloquear o liberar la habitación.
Si dos reservas pidieran la misma noche, la base de datos lanza IntegrityError y la operación completa se revierte.

Las actualizaciones masivas (`query.update`) no pasan por aquí: el vencimiento automático llama a `liberar`.
"""
from datetime import date, timedelta

from sqlalchemy import event
from sqlalchemy.orm import Session

from app.models.reserva import Reserva
from app.models.reserva_noche import ReservaNoche

ESTADOS_QUE_BLOQUEAN = ("pendiente", "confirmada", "checkin")


def noches_de(reserva: Reserva) -> set[tuple[int, date]]:
    """Noches que debería bloquear la reserva según su estado actual: {(habitacion_id, fecha)}."""
    if reserva.estado not in ESTADOS_QUE_BLOQUEAN or not reserva.habitacion_id:
        return set()
    entrada, salida = reserva.fecha_checkin_prevista, reserva.fecha_checkout_prevista
    if not entrada or not salida or salida <= entrada:
        return set()
    return {(reserva.habitacion_id, entrada + timedelta(days=i)) for i in range((salida - entrada).days)}


def sincronizar(reserva: Reserva) -> None:
    deseadas = noches_de(reserva)
    actuales = {(n.habitacion_id, n.fecha): n for n in reserva.noches}
    for clave, noche in actuales.items():
        if clave not in deseadas:
            reserva.noches.remove(noche)  # delete-orphan la borra
    for habitacion_id, fecha in sorted(deseadas - set(actuales)):
        reserva.noches.append(ReservaNoche(habitacion_id=habitacion_id, fecha=fecha))


@event.listens_for(Session, "before_flush")
def _sincronizar_antes_de_guardar(session: Session, flush_context, instances) -> None:
    for objeto in list(session.new) + list(session.dirty):
        if isinstance(objeto, Reserva) and objeto not in session.deleted:
            sincronizar(objeto)


def liberar(db: Session, reserva_ids: list[int]) -> None:
    """Borra las noches de reservas que cambiaron de estado con una actualización masiva (sin ORM)."""
    if reserva_ids:
        db.query(ReservaNoche).filter(ReservaNoche.reserva_id.in_(reserva_ids)).delete(synchronize_session=False)


def habitaciones_ocupadas(db: Session, checkin: date, checkout: date) -> set[int]:
    """Ids de las habitaciones con una reserva vigente que se cruza con [checkin, checkout)."""
    filas = (
        db.query(Reserva.habitacion_id)
        .filter(
            Reserva.estado.in_(ESTADOS_QUE_BLOQUEAN),
            Reserva.fecha_checkin_prevista < checkout,
            Reserva.fecha_checkout_prevista > checkin,
        )
        .distinct()
        .all()
    )
    return {f[0] for f in filas}
