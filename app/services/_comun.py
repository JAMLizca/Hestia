"""Utilidades compartidas por los servicios."""
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errores import Conflicto


def confirmar_cambios(db: Session) -> None:
    """
    Guarda la transacción. Las validaciones de los servicios dan mensajes claros, pero dos peticiones
    simultáneas pueden pasarlas a la vez: en ese caso la restricción UNIQUE de `reserva_noches` rechaza la
    segunda y aquí se traduce al mismo conflicto.
    """
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        if "reserva_noches" in str(exc.orig):
            raise Conflicto("La habitación ya está reservada en ese rango de fechas") from exc
        raise
