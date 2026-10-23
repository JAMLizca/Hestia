"""
Servicios consumidos dentro de una reserva. El precio se congela al agregar.
Las reglas están en app/services/consumos.py.
"""
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.schemas.reserva_servicio import ReservaServicioCreate, ReservaServicioOut, ReservaServicioUpdate
from app.services import consumos as servicio
from app.services.consumos import ESTADOS_QUE_PERMITEN_MODIFICAR  # noqa: F401 (compatibilidad)

router = APIRouter(prefix="/reservas/{reserva_id}/servicios", tags=["Servicios de Reserva"], dependencies=[Depends(get_current_user)])


@router.get("/", response_model=list[ReservaServicioOut])
def listar_servicios_reserva(reserva_id: int, db: Session = Depends(get_db)):
    return servicio.listar(db, reserva_id)


@router.post("/", response_model=ReservaServicioOut, status_code=status.HTTP_201_CREATED)
def agregar_servicio_a_reserva(reserva_id: int, datos: ReservaServicioCreate, db: Session = Depends(get_db)):
    return servicio.agregar(db, reserva_id, datos)


@router.put("/{reserva_servicio_id}", response_model=ReservaServicioOut, summary="Corrige la cantidad de un consumo")
def editar_servicio_de_reserva(reserva_id: int, reserva_servicio_id: int, datos: ReservaServicioUpdate, db: Session = Depends(get_db)):
    """El precio unitario no cambia (es el que se congeló al agregar). 409 si el pagado quedaría por encima del total."""
    return servicio.editar(db, reserva_id, reserva_servicio_id, datos)


@router.delete("/{reserva_servicio_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Quita un consumo de la reserva")
def quitar_servicio_de_reserva(reserva_id: int, reserva_servicio_id: int, db: Session = Depends(get_db)):
    servicio.quitar(db, reserva_id, reserva_servicio_id)
