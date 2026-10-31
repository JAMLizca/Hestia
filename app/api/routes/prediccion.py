"""
Predicción de ocupación (Hestia Intelligence). Las reglas están en app/services/inteligencia.py.
"""
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, liberar_pendientes_vencidas
from app.schemas.inteligencia import PrediccionOcupacion
from app.services import inteligencia as servicio

router = APIRouter(
    prefix="/prediccion",
    tags=["Predicción de ocupación"],
    dependencies=[Depends(get_current_user), Depends(liberar_pendientes_vencidas)],
)


@router.get("/ocupacion", response_model=PrediccionOcupacion, summary="Ocupación esperada por día (hasta 30 días hacia adelante)")
def ocupacion(
    desde: date | None = Query(default=None, description="Primer día a predecir (YYYY-MM-DD). Por defecto, hoy."),
    dias: int = Query(default=7, ge=1, le=30, description="Cuántos días predecir"),
    db: Session = Depends(get_db),
):
    return servicio.pronosticar_ocupacion(db, desde, dias)
