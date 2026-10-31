"""
Recomendación de habitaciones para recepción (Hestia Intelligence). Las reglas están en app/services/inteligencia.py.
La versión para el huésped está en reservas_web.py (/publico/recomendacion).
"""
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, liberar_pendientes_vencidas
from app.schemas.inteligencia import RecomendacionOut
from app.services import inteligencia as servicio

router = APIRouter(
    prefix="/recomendacion",
    tags=["Recomendación de habitaciones"],
    dependencies=[Depends(get_current_user), Depends(liberar_pendientes_vencidas)],
)

Canal = Literal["presencial", "telefono", "whatsapp", "correo", "web", "otro"]


@router.get("/habitaciones", response_model=list[RecomendacionOut], summary="Sugiere habitaciones libres que se ajustan a la reserva y a las preferencias")
def recomendar_habitaciones(
    llegada: date = Query(...),
    salida: date = Query(...),
    huespedes: int = Query(default=1, ge=1, le=10),
    piso: Literal["bajo", "alto"] | None = None,
    vista: Literal["exterior", "interior"] | None = None,
    cama: Literal["doble", "sencillas"] | None = None,
    tranquila: bool = False,
    accesible: bool = False,
    canal: Canal = "presencial",
    db: Session = Depends(get_db),
):
    prefs = {"piso": piso, "vista": vista, "cama": cama, "tranquila": tranquila, "accesible": accesible}
    return servicio.recomendar(db, llegada, salida, huespedes, prefs, canal, por_habitacion=True)
