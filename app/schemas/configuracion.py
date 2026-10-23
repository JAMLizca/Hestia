"""
Esquemas Pydantic de la configuración general del hotel.
"""
from datetime import datetime, time
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

# Opciones admitidas. El frontend ofrece exactamente estas.
MONEDAS = ("COP", "USD", "EUR", "MXN", "PEN", "CLP", "ARS", "BRL")
ZONAS_HORARIAS = (
    "America/Bogota",
    "America/Lima",
    "America/Mexico_City",
    "America/Santiago",
    "America/Argentina/Buenos_Aires",
    "America/Sao_Paulo",
    "America/New_York",
    "America/Los_Angeles",
    "Europe/Madrid",
    "UTC",
)
Moneda = Literal[MONEDAS]  # type: ignore[valid-type]
ZonaHoraria = Literal[ZONAS_HORARIAS]  # type: ignore[valid-type]

# Lo que devuelve la API mientras el administrador no haya guardado nada.
VALORES_POR_DEFECTO = {
    "nombre": "Hotel Hestia",
    "razon_social": None,
    "nit": None,
    "direccion": None,
    "ciudad": None,
    "pais": "Colombia",
    "telefono": None,
    "email": None,
    "sitio_web": None,
    "hora_checkin": time(15, 0),
    "hora_checkout": time(12, 0),
    "horas_vencimiento_pendiente": 24,
    "reservas_web_activas": False,
    "anticipo_porcentaje": 0,
    "moneda": "COP",
    "zona_horaria": "America/Bogota",
}

# Campos que no admiten null (columnas NOT NULL).
CAMPOS_OBLIGATORIOS = ("nombre", "hora_checkin", "hora_checkout", "horas_vencimiento_pendiente", "reservas_web_activas", "anticipo_porcentaje", "moneda", "zona_horaria")


def _limpiar(valor):
    """Recorta espacios; una cadena vacía equivale a "sin dato"."""
    if isinstance(valor, str):
        valor = valor.strip()
        return valor or None
    return valor


class ConfiguracionBase(BaseModel):
    nombre: str = Field(min_length=1, max_length=150)
    razon_social: str | None = Field(default=None, max_length=150)
    nit: str | None = Field(default=None, max_length=30)
    direccion: str | None = Field(default=None, max_length=200)
    ciudad: str | None = Field(default=None, max_length=100)
    pais: str | None = Field(default=None, max_length=100)
    telefono: str | None = Field(default=None, max_length=30)
    email: EmailStr | None = None
    sitio_web: str | None = Field(default=None, max_length=200)
    hora_checkin: time
    hora_checkout: time
    horas_vencimiento_pendiente: int = Field(ge=0, le=720)
    reservas_web_activas: bool
    anticipo_porcentaje: int = Field(ge=0, le=100)
    moneda: Moneda
    zona_horaria: ZonaHoraria


class ConfiguracionUpdate(BaseModel):
    """Todos los campos son opcionales: solo se actualiza lo que se envíe."""

    model_config = ConfigDict(extra="forbid")

    nombre: str | None = Field(default=None, min_length=1, max_length=150)
    razon_social: str | None = Field(default=None, max_length=150)
    nit: str | None = Field(default=None, max_length=30)
    direccion: str | None = Field(default=None, max_length=200)
    ciudad: str | None = Field(default=None, max_length=100)
    pais: str | None = Field(default=None, max_length=100)
    telefono: str | None = Field(default=None, max_length=30)
    email: EmailStr | None = None
    sitio_web: str | None = Field(default=None, max_length=200)
    hora_checkin: time | None = None
    hora_checkout: time | None = None
    horas_vencimiento_pendiente: int | None = Field(default=None, ge=0, le=720)
    reservas_web_activas: bool | None = None
    anticipo_porcentaje: int | None = Field(default=None, ge=0, le=100)
    moneda: Moneda | None = None
    zona_horaria: ZonaHoraria | None = None

    @field_validator(
        "nombre", "razon_social", "nit", "direccion", "ciudad", "pais", "telefono", "email", "sitio_web", mode="before"
    )
    @classmethod
    def _recortar(cls, valor):
        return _limpiar(valor)


class ConfiguracionOut(ConfiguracionBase):
    """Configuración vigente. `fecha_actualizacion` es null si aún no se ha guardado nada."""

    fecha_actualizacion: datetime | None = None
    # Solo lectura: las llaves de Wompi están en el .env del servidor (nunca viajan por la API).
    pasarela_configurada: bool = False

    model_config = ConfigDict(from_attributes=True)
