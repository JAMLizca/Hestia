"""
Endpoints CRUD de huéspedes. Las reglas están en app/services/huespedes.py.
"""
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.schemas.huesped import HuespedCreate, HuespedOut, HuespedUpdate
from app.services import huespedes as servicio

router = APIRouter(prefix="/huespedes", tags=["Huéspedes"], dependencies=[Depends(get_current_user)])


@router.get("/", response_model=list[HuespedOut], summary="Lista todos los huéspedes")
def listar_huespedes(db: Session = Depends(get_db)):
    return servicio.listar(db)


@router.get("/{huesped_id}", response_model=HuespedOut, summary="Consulta un huésped por id")
def obtener_huesped(huesped_id: int, db: Session = Depends(get_db)):
    return servicio.obtener(db, huesped_id)


@router.post("/", response_model=HuespedOut, status_code=status.HTTP_201_CREATED, summary="Registra un nuevo huésped")
def crear_huesped(huesped_in: HuespedCreate, db: Session = Depends(get_db)):
    return servicio.crear(db, huesped_in)


@router.put("/{huesped_id}", response_model=HuespedOut, summary="Actualiza los datos de un huésped")
def actualizar_huesped(huesped_id: int, huesped_in: HuespedUpdate, db: Session = Depends(get_db)):
    return servicio.editar(db, huesped_id, huesped_in)


@router.delete(
    "/{huesped_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Elimina un huésped (solo administrador/gerente)",
)
def eliminar_huesped(huesped_id: int, db: Session = Depends(get_db)):
    servicio.eliminar(db, huesped_id)
