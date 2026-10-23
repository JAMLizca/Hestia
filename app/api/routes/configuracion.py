"""
Configuración general del hotel: datos del establecimiento, horarios de check-in/out
y ajustes regionales (moneda, zona horaria).

Cualquier usuario autenticado puede consultarla (el panel muestra el nombre del hotel
y formatea los montos con la moneda); solo el administrador puede modificarla.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.api.deps import get_current_user, get_db, require_roles
from app.models.configuracion import CONFIG_ID, ConfiguracionHotel
from app.schemas.configuracion import (
    CAMPOS_OBLIGATORIOS,
    VALORES_POR_DEFECTO,
    ConfiguracionOut,
    ConfiguracionUpdate,
)

router = APIRouter(
    prefix="/configuracion",
    tags=["Configuración"],
    dependencies=[Depends(get_current_user)],
)


def _salida(config: ConfiguracionHotel) -> ConfiguracionOut:
    return ConfiguracionOut.model_validate(config).model_copy(update={"pasarela_configurada": settings.WOMPI_CONFIGURADO})


@router.get("/", response_model=ConfiguracionOut, summary="Consulta la configuración del hotel")
def obtener_configuracion(db: Session = Depends(get_db)):
    """Devuelve los valores por defecto mientras el administrador no haya guardado nada."""
    config = db.get(ConfiguracionHotel, CONFIG_ID)
    if config is None:
        return ConfiguracionOut(**VALORES_POR_DEFECTO, pasarela_configurada=settings.WOMPI_CONFIGURADO)
    return _salida(config)


@router.put(
    "/",
    response_model=ConfiguracionOut,
    summary="Actualiza la configuración del hotel (solo administrador)",
    dependencies=[Depends(require_roles("administrador"))],
)
def actualizar_configuracion(datos: ConfiguracionUpdate, db: Session = Depends(get_db)):
    """Actualización parcial: solo se modifican los campos enviados."""
    cambios = datos.model_dump(exclude_unset=True)
    for campo in CAMPOS_OBLIGATORIOS:
        if campo in cambios and cambios[campo] is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"El campo '{campo}' no puede ser nulo",
            )

    config = db.get(ConfiguracionHotel, CONFIG_ID)
    if config is None:
        config = ConfiguracionHotel(id=CONFIG_ID, **VALORES_POR_DEFECTO)
        db.add(config)
    for campo, valor in cambios.items():
        setattr(config, campo, valor)
    try:
        db.commit()
    except IntegrityError:
        # Dos administradores guardaron por primera vez a la vez: la fila ya existe.
        db.rollback()
        config = db.get(ConfiguracionHotel, CONFIG_ID)
        for campo, valor in cambios.items():
            setattr(config, campo, valor)
        db.commit()
    db.refresh(config)
    return _salida(config)
