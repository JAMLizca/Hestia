"""
Configuración general del hotel
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.schemas.configuracion import ConfiguracionOut, ConfiguracionUpdate
from app.services import configuracion as servicio

router = APIRouter(prefix="/configuracion", tags=["Configuración"], dependencies=[Depends(get_current_user)])


@router.get("/", response_model=ConfiguracionOut, summary="Consulta la configuración del hotel")
def obtener_configuracion(db: Session = Depends(get_db)):
    return servicio.obtener(db)


@router.put(
    "/",
    response_model=ConfiguracionOut,
    summary="Actualiza la configuración del hotel (solo administrador)",
)
def actualizar_configuracion(datos: ConfiguracionUpdate, db: Session = Depends(get_db)):
    return servicio.actualizar(db, datos)
