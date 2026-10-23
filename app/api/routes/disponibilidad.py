"""
Endpoint de disponibilidad de habitaciones. Las reglas están en app/services/disponibilidad.py.
"""
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, liberar_pendientes_vencidas
from app.schemas.habitacion import HabitacionOut
from app.services import disponibilidad as servicio

router = APIRouter(
    prefix="/disponibilidad",
    tags=["Disponibilidad"],
    dependencies=[Depends(get_current_user), Depends(liberar_pendientes_vencidas)],
)


@router.get("/", response_model=list[HabitacionOut], summary="Lista las habitaciones disponibles en un rango de fechas")
def consultar_disponibilidad(
    fecha_checkin: date = Query(..., description="Fecha de entrada (YYYY-MM-DD)"),
    fecha_checkout: date = Query(..., description="Fecha de salida (YYYY-MM-DD)"),
    tipo_habitacion_id: int | None = Query(default=None, description="Filtra por tipo de habitación"),
    db: Session = Depends(get_db),
):
    return servicio.consultar(db, fecha_checkin, fecha_checkout, tipo_habitacion_id)
