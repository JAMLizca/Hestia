"""
Resumen/factura de una reserva: costo habitación + servicios, y saldo pendiente.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.schemas.factura import ResumenReserva
from app.services import facturacion

router = APIRouter(prefix="/reservas/{reserva_id}/resumen", tags=["Facturación"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=ResumenReserva)
def obtener_resumen(reserva_id: int, db: Session = Depends(get_db)):
    return facturacion.resumen(db, reserva_id)
