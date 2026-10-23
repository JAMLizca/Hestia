"""
Esquemas Pydantic del pre-check-in: lo que el huésped envía desde el enlace público y lo que
ve recepción.
"""
from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

TipoDocumento = Literal["CC", "CE", "TI", "PA", "PEP", "OTRO"]
MotivoViaje = Literal["turismo", "negocios", "salud", "estudio", "familia", "otro"]
EstadoPreCheckin = Literal["enviado", "completado", "validado"]


def _texto(valor):
    """Recorta espacios y convierte el texto vacío en None."""
    if isinstance(valor, str):
        valor = valor.strip()
        return valor or None
    return valor


class _Persona(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tipo_documento: TipoDocumento
    documento_identidad: str = Field(min_length=3, max_length=30)
    nombres: str = Field(min_length=1, max_length=100)
    apellidos: str = Field(min_length=1, max_length=100)
    nacionalidad: str = Field(min_length=2, max_length=60)
    fecha_nacimiento: date

    @field_validator("documento_identidad", "nombres", "apellidos", "nacionalidad", mode="before")
    @classmethod
    def _recortar(cls, v):
        return v.strip() if isinstance(v, str) else v

    @field_validator("fecha_nacimiento")
    @classmethod
    def _fecha_razonable(cls, v: date):
        hoy = date.today()
        if v >= hoy:
            raise ValueError("La fecha de nacimiento debe ser anterior a hoy")
        if v.year < hoy.year - 120:
            raise ValueError("La fecha de nacimiento no es válida")
        return v


class Titular(_Persona):
    telefono: str = Field(min_length=7, max_length=30)
    email: EmailStr
    procedencia: str | None = Field(default=None, max_length=100)

    @field_validator("procedencia", "telefono", mode="before")
    @classmethod
    def _limpiar(cls, v):
        return _texto(v)


class Acompanante(_Persona):
    pass


class PreCheckinEnvio(BaseModel):
    """Cuerpo del PUT público. Los acompañantes son los demás huéspedes de la reserva."""

    model_config = ConfigDict(extra="forbid")

    titular: Titular
    acompanantes: list[Acompanante] = Field(default_factory=list, max_length=20)
    hora_llegada: time | None = None
    motivo_viaje: MotivoViaje | None = None
    notas: str | None = Field(default=None, max_length=500)

    @field_validator("notas", mode="before")
    @classmethod
    def _limpiar_notas(cls, v):
        return _texto(v)

    @model_validator(mode="after")
    def _documentos_distintos(self):
        documentos = [(self.titular.tipo_documento, self.titular.documento_identidad.upper())]
        documentos += [(a.tipo_documento, a.documento_identidad.upper()) for a in self.acompanantes]
        if len(set(documentos)) != len(documentos):
            raise ValueError("Hay dos personas con el mismo documento")
        return self


class PreCheckinPublico(BaseModel):
    """Lo que ve quien abre el enlace: solo lo necesario para completar el formulario."""

    hotel_nombre: str
    hora_checkin: str
    codigo: str
    fecha_checkin: date
    fecha_checkout: date
    noches: int
    num_huespedes: int
    estado: EstadoPreCheckin
    # Solo nombre y nacionalidad: el documento, el teléfono y el correo los escribe el huésped.
    titular: dict
    datos: dict | None = None
    editable: bool


class PreCheckinOut(BaseModel):
    """Lo que ve recepción en el detalle de la reserva."""

    reserva_id: int
    token: str
    enlace: str  # ruta relativa en el panel (ej. /pre-checkin/<token>); el cliente le antepone su dominio
    estado: EstadoPreCheckin
    datos: dict | None = None
    fecha_creacion: datetime | None = None
    fecha_completado: datetime | None = None
    fecha_validacion: datetime | None = None
    huesped: dict | None = None  # datos actuales del huésped, para compararlos con lo declarado

    model_config = ConfigDict(from_attributes=True)


class ValidarPreCheckin(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # Solo si el documento declarado difiere del registrado y recepción confirma que el registrado era un error.
    actualizar_documento: bool = False
