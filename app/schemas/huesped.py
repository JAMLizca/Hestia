"""
Esquemas Pydantic para la entidad Huesped.

Los límites coinciden con las columnas de `app/models/huesped.py`: si se
sobrepasan, el valor debe rechazarse aquí con un 422 explicativo y no llegar
a MySQL, que respondería con un error no controlado.
"""
from datetime import date

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


def _texto(v):
    """Recorta espacios y convierte el texto vacío en None."""
    if not isinstance(v, str):
        return v
    v = v.strip()
    return v or None


class _ValidacionesHuesped(BaseModel):
    """Reglas comunes a crear y actualizar (`check_fields=False` porque no
    todas las clases hijas declaran todos los campos)."""

    @field_validator(
        "documento_identidad", "tipo_documento", "nombres", "apellidos",
        mode="before", check_fields=False,
    )
    @classmethod
    def _recortar_obligatorio(cls, v):
        """Solo recorta: el texto en blanco queda vacío y lo rechaza `min_length`,
        en lugar de volverse None y borrar una columna que no admite nulos."""
        return v.strip() if isinstance(v, str) else v

    @field_validator("telefono", "nacionalidad", "preferencias", mode="before", check_fields=False)
    @classmethod
    def _recortar_opcional(cls, v):
        return _texto(v)

    @field_validator("telefono", check_fields=False)
    @classmethod
    def _telefono_valido(cls, v: str | None):
        if v is not None and not all(c.isdigit() or c in " +-()" for c in v):
            raise ValueError("El teléfono solo admite dígitos y los signos + - ( )")
        return v

    @field_validator("fecha_nacimiento", check_fields=False)
    @classmethod
    def _fecha_razonable(cls, v: date | None):
        if v is None:
            return v
        hoy = date.today()
        if v >= hoy:
            raise ValueError("La fecha de nacimiento debe ser anterior a hoy")
        if v.year < hoy.year - 120:
            raise ValueError("La fecha de nacimiento no es válida")
        return v


class HuespedBase(_ValidacionesHuesped):
    documento_identidad: str = Field(min_length=3, max_length=30)
    tipo_documento: str = Field(default="CC", max_length=20)
    nombres: str = Field(min_length=1, max_length=100)
    apellidos: str = Field(min_length=1, max_length=100)
    email: EmailStr | None = Field(default=None, max_length=150)
    telefono: str | None = Field(default=None, min_length=7, max_length=30)
    nacionalidad: str | None = Field(default=None, min_length=2, max_length=60)
    fecha_nacimiento: date | None = None
    preferencias: str | None = Field(default=None, max_length=255)


class HuespedCreate(HuespedBase):
    pass


class HuespedUpdate(_ValidacionesHuesped):
    """Todos los campos son opcionales: solo se actualiza lo que se envía."""

    tipo_documento: str | None = Field(default=None, min_length=1, max_length=20)
    nombres: str | None = Field(default=None, min_length=1, max_length=100)
    apellidos: str | None = Field(default=None, min_length=1, max_length=100)
    email: EmailStr | None = Field(default=None, max_length=150)
    telefono: str | None = Field(default=None, min_length=7, max_length=30)
    nacionalidad: str | None = Field(default=None, min_length=2, max_length=60)
    fecha_nacimiento: date | None = None
    preferencias: str | None = Field(default=None, max_length=255)


class HuespedOut(HuespedBase):
    id: int
    model_config = ConfigDict(from_attributes=True)
