"""Huéspedes: consulta, alta, edición y baja."""
from sqlalchemy.orm import Session

from app.core.errores import NoEncontrado, SolicitudInvalida
from app.models.huesped import Huesped
from app.schemas.huesped import HuespedCreate, HuespedUpdate
from app.services._comun import confirmar_cambios

# Columnas NOT NULL: un null explícito en el PUT daría error 500 en la base de datos.
CAMPOS_OBLIGATORIOS = ("tipo_documento", "nombres", "apellidos")


def obtener(db: Session, huesped_id: int) -> Huesped:
    huesped = db.query(Huesped).filter(Huesped.id == huesped_id).first()
    if not huesped:
        raise NoEncontrado(f"No existe un huésped con id {huesped_id}")
    return huesped


def listar(db: Session) -> list[Huesped]:
    return db.query(Huesped).all()


def crear(db: Session, datos: HuespedCreate) -> Huesped:
    if db.query(Huesped).filter(Huesped.documento_identidad == datos.documento_identidad).first():
        raise SolicitudInvalida(f"Ya existe un huésped con el documento '{datos.documento_identidad}'")
    nuevo = Huesped(**datos.model_dump())
    db.add(nuevo)
    confirmar_cambios(db)
    db.refresh(nuevo)
    return nuevo


def editar(db: Session, huesped_id: int, datos_in: HuespedUpdate) -> Huesped:
    huesped = obtener(db, huesped_id)
    datos = datos_in.model_dump(exclude_unset=True)
    for campo in CAMPOS_OBLIGATORIOS:
        if campo in datos and datos[campo] is None:
            raise SolicitudInvalida(f"El campo '{campo}' no puede ser nulo")
    for campo, valor in datos.items():
        setattr(huesped, campo, valor)
    confirmar_cambios(db)
    db.refresh(huesped)
    return huesped


def eliminar(db: Session, huesped_id: int) -> None:
    huesped = obtener(db, huesped_id)
    if huesped.reservas:
        raise SolicitudInvalida("No se puede eliminar: el huésped tiene reservas asociadas")
    db.delete(huesped)
    confirmar_cambios(db)
