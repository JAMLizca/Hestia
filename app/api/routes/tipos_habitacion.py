"""
Endpoints CRUD de tipos de habitación. Las reglas están en app/services/tipos_habitacion.py.
"""
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.schemas.tipo_habitacion import TipoHabitacionCreate, TipoHabitacionOut, TipoHabitacionUpdate
from app.services import tipos_habitacion as servicio

router = APIRouter(prefix="/tipos-habitacion", tags=["Tipos de Habitación"], dependencies=[Depends(get_current_user)])



@router.get("/", response_model=list[TipoHabitacionOut], summary="Lista todos los tipos de habitación")
def listar_tipos(db: Session = Depends(get_db)):
    return servicio.listar(db)


@router.get("/{tipo_id}", response_model=TipoHabitacionOut, summary="Consulta un tipo de habitación por id")
def obtener_tipo(tipo_id: int, db: Session = Depends(get_db)):
    return servicio.obtener(db, tipo_id)


@router.post("/", response_model=TipoHabitacionOut, status_code=status.HTTP_201_CREATED, summary="Crea un nuevo tipo de habitación (admin/gerente)")
def crear_tipo(tipo_in: TipoHabitacionCreate, db: Session = Depends(get_db)):
    return servicio.crear(db, tipo_in)


@router.put("/{tipo_id}", response_model=TipoHabitacionOut, summary="Actualiza un tipo de habitación (admin/gerente)")
def actualizar_tipo(tipo_id: int, tipo_in: TipoHabitacionUpdate, db: Session = Depends(get_db)):
    return servicio.editar(db, tipo_id, tipo_in)


@router.delete("/{tipo_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Elimina un tipo de habitación (admin/gerente)")
def eliminar_tipo(tipo_id: int, db: Session = Depends(get_db)):
    servicio.eliminar(db, tipo_id)
