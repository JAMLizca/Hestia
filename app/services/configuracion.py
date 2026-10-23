"""Configuración general del hotel (una sola fila)."""
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errores import SolicitudInvalida
from app.models.configuracion import CONFIG_ID, ConfiguracionHotel
from app.schemas.configuracion import CAMPOS_OBLIGATORIOS, VALORES_POR_DEFECTO, ConfiguracionOut, ConfiguracionUpdate


def _salida(config: ConfiguracionHotel) -> ConfiguracionOut:
    return ConfiguracionOut.model_validate(config).model_copy(update={"pasarela_configurada": settings.WOMPI_CONFIGURADO})


def obtener(db: Session) -> ConfiguracionOut:
    """Devuelve los valores por defecto mientras el administrador no haya guardado nada."""
    config = db.get(ConfiguracionHotel, CONFIG_ID)
    if config is None:
        return ConfiguracionOut(**VALORES_POR_DEFECTO, pasarela_configurada=settings.WOMPI_CONFIGURADO)
    return _salida(config)


def actualizar(db: Session, datos: ConfiguracionUpdate) -> ConfiguracionOut:
    """Actualización parcial: solo se modifican los campos enviados."""
    cambios = datos.model_dump(exclude_unset=True)
    for campo in CAMPOS_OBLIGATORIOS:
        if campo in cambios and cambios[campo] is None:
            raise SolicitudInvalida(f"El campo '{campo}' no puede ser nulo")

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
