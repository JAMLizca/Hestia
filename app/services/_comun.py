"""Utilidades compartidas por los servicios."""
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errores import Conflicto


def confirmar_cambios(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        if "reserva_noches" in str(exc.orig):
            raise Conflicto("La habitación ya está reservada en ese rango de fechas") from exc
        raise
