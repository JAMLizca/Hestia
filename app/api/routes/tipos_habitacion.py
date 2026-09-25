"""
Endpoints CRUD de la entidad TipoHabitacion.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from app.models.tipo_habitacion import TipoHabitacion
from app.schemas.tipo_habitacion import (
    TipoHabitacionCreate,
    TipoHabitacionOut,
    TipoHabitacionUpdate,
)

router = APIRouter(
    prefix="/tipos-habitacion",
    tags=["Tipos de Habitación"],
    dependencies=[Depends(get_current_user)],
)


def _obtener_o_404(db: Session, tipo_id: int) -> TipoHabitacion:
    tipo = db.query(TipoHabitacion).filter(TipoHabitacion.id == tipo_id).first()
    if not tipo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No existe un tipo de habitación con id {tipo_id}",
        )
    return tipo


@router.get("/", response_model=list[TipoHabitacionOut], summary="Lista todos los tipos de habitación")
def listar_tipos(db: Session = Depends(get_db)):
    return db.query(TipoHabitacion).all()


@router.get("/{tipo_id}", response_model=TipoHabitacionOut, summary="Consulta un tipo de habitación por id")
def obtener_tipo(tipo_id: int, db: Session = Depends(get_db)):
    return _obtener_o_404(db, tipo_id)


@router.post(
    "/",
    response_model=TipoHabitacionOut,
    status_code=status.HTTP_201_CREATED,
    summary="Crea un nuevo tipo de habitación (admin/gerente)",
    dependencies=[Depends(require_roles("administrador", "gerente"))],
)
def crear_tipo(tipo_in: TipoHabitacionCreate, db: Session = Depends(get_db)):
    existe = db.query(TipoHabitacion).filter(TipoHabitacion.nombre == tipo_in.nombre).first()
    if existe:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ya existe un tipo de habitación con el nombre '{tipo_in.nombre}'",
        )
    nuevo_tipo = TipoHabitacion(**tipo_in.model_dump())
    db.add(nuevo_tipo)
    db.commit()
    db.refresh(nuevo_tipo)
    return nuevo_tipo


@router.put(
    "/{tipo_id}",
    response_model=TipoHabitacionOut,
    summary="Actualiza un tipo de habitación (admin/gerente)",
    dependencies=[Depends(require_roles("administrador", "gerente"))],
)
def actualizar_tipo(tipo_id: int, tipo_in: TipoHabitacionUpdate, db: Session = Depends(get_db)):
    tipo = _obtener_o_404(db, tipo_id)
    datos = tipo_in.model_dump(exclude_unset=True)
    for campo, valor in datos.items():
        setattr(tipo, campo, valor)
    db.commit()
    db.refresh(tipo)
    return tipo


@router.delete(
    "/{tipo_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Elimina un tipo de habitación (admin/gerente)",
    dependencies=[Depends(require_roles("administrador", "gerente"))],
)
def eliminar_tipo(tipo_id: int, db: Session = Depends(get_db)):
    tipo = _obtener_o_404(db, tipo_id)
    if tipo.habitaciones:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede eliminar: hay habitaciones asociadas a este tipo",
        )
    db.delete(tipo)
    db.commit()