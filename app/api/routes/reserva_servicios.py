"""
Servicos consumidos dentro de una reserva. El precio se congela al agregar.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db
from app.models.reserva import Reserva
from app.models.reserva_servicio import ReservaServicio
from app.models.servicio import Servicio
from app.schemas.reserva_servicio import ReservaServicioCreate, ReservaServicioOut

router = APIRouter(prefix="/reservas/{reserva_id}/servicios", tags=["Servicios de Reserva"], dependencies=[Depends(get_current_user)])

ESTADOS_QUE_PERMITEN_MODIFICAR = ("pendiente", "confirmada", "checkin")


def _obtener_reserva_o_404(db: Session, reserva_id: int) -> Reserva:
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No existe una reserva con id {reserva_id}")
    return reserva


@router.get("/", response_model=list[ReservaServicioOut])
def listar_servicios_reserva(reserva_id: int, db: Session = Depends(get_db)):
    _obtener_reserva_o_404(db, reserva_id)
    return db.query(ReservaServicio).filter(ReservaServicio.reserva_id == reserva_id).all()


@router.post("/", response_model=ReservaServicioOut, status_code=status.HTTP_201_CREATED)

def agregar_servicio_a_reserva(reserva_id: int, datos: ReservaServicioCreate, db: Session = Depends(get_db)):
    reserva = _obtener_reserva_o_404(db, reserva_id)

    if reserva.estado not in ESTADOS_QUE_PERMITEN_MODIFICAR:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"No se pueden agregar servicios a una reserva en estado '{reserva.estado}'")

    servicio = db.query(Servicio).filter(Servicio.id == datos.servicio_id).first()
    if not servicio:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"El servicio con id {datos.servicio_id} no existe")

    nuevo = ReservaServicio(
        reserva_id=reserva_id,
        servicio_id=datos.servicio_id,
        cantidad=datos.cantidad,
        precio_unitario=servicio.precio,
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo


@router.delete("/{reserva_servicio_id}", status_code=status.HTTP_204_NO_CONTENT)
def quitar_servicio_de_reserva(reserva_id: int, reserva_servicio_id: int, db: Session = Depends(get_db)):
    reserva = _obtener_reserva_o_404(db, reserva_id)
    if reserva.estado not in ESTADOS_QUE_PERMITEN_MODIFICAR:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"No se pueden modificar los servicios de una reserva en estado '{reserva.estado}'")

    item = (
        db.query(ReservaServicio)
        .filter(ReservaServicio.id == reserva_servicio_id, ReservaServicio.reserva_id == reserva_id)
        .first()

    )
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No existe ese servicio dentro de la reserva")
    db.delete(item)
    db.commit()
