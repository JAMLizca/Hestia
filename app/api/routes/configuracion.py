"""
Configuración general del hotel: datos del establecimiento, horarios de check-in/out y ajustes regionales
(moneda, zona horaria).

Cualquier usuario autenticado puede consultarla (el panel muestra el nombre del hotel y formatea los montos con
la moneda); solo el administrador puede modificarla. Las reglas están en app/services/configuracion.py.
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
