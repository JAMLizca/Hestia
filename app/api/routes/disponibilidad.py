"""
Endpoint de disponibilidad de habitaciones.
"""
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db
from app.models.habitacion import Habitacion
from app.models.reserva import Reserva
from app.schemas.habitacion import HabitacionOut

router = APIRouter(
    prefix="/disponibilidad",
    tags=["Disponibilidad"],
    dependencies=[Depends(get_current_user)],
)

ESTADOS_QUE_BLOQUEAN = ("pendiente", "confirmada", "checkin")


@router.get(
    "/",
    response_model=list[HabitacionOut],
    summary="Lista las habitaciones disponibles en un rango de fechas",

)
def consultar_disponibilidad(
    fecha_checkin: date = Query(..., description="Fecha de entrada (YYYY-MM-DD)"),
    fecha_checkout: date = Query(..., description="Fecha de salida (YYYY-MM-DD)"),
    tipo_habitacion_id: int | None = Query(default=None, description="Filtra por tipo de habitación"),
    db: Session = Depends(get_db),
):
    """
    Una habitación está disponible si:
    1. Su estado operativo no es "mantenimiento".
    2. No tiene ninguna reserva activa (pendiente, confirmada o en
       checkin) cuyas fechas se crucen con el rango solicitado.
    """
    if fecha_checkout <= fecha_checkin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La fecha de checkout debe ser posterior a la de checkin",
        )

    ids_ocupados = [
        fila[0]
        for fila in db.query(Reserva.habitacion_id)
        .filter(
            Reserva.estado.in_(ESTADOS_QUE_BLOQUEAN),
            Reserva.fecha_checkin_prevista < fecha_checkout,
            Reserva.fecha_checkout_prevista > fecha_checkin,
        )
        .distinct()
        .all()
    ]

    query = db.query(Habitacion).filter(Habitacion.estado != "mantenimiento")

    if ids_ocupados:
        query = query.filter(~Habitacion.id.in_(ids_ocupados))
    if tipo_habitacion_id:
        query = query.filter(Habitacion.tipo_habitacion_id == tipo_habitacion_id)

    return query.all()

"""
Corregir bug: si no hay habitaciones ocupadas, la consulta de disponibilidad
debería devolver todas las habitaciones que no estén en mantenimiento, y no
ninguna. Por eso se hace la verificación de `if ids_ocupados:` antes de aplicar el filtro `~Habitacion.id.in_(ids_ocupados)`.
"""
