"""
Pagos asociados a una reserva. Una reserva puede tener varios pagos.
"""
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_db
from app.models.pago import Pago
from app.models.reserva import Reserva
from app.schemas.pago import PagoCreate, PagoOut

router = APIRouter(prefix="/reservas/{reserva_id}/pagos", tags=["Pagos"], dependencies=[Depends(get_current_user)])


def _obtener_reserva_o_404(db: Session, reserva_id: int) -> Reserva:
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No existe una reserva con id {reserva_id}")
    return reserva


def _saldo_pendiente(reserva: Reserva) -> Decimal:
    """Mismo cálculo que el resumen de facturación: habitación + servicios - pagos 'pagado'."""
    costo_servicios = sum(
        (item.cantidad * item.precio_unitario for item in reserva.reserva_servicios), Decimal("0")
    )
    total_pagado = sum((p.monto for p in reserva.pagos if p.estado == "pagado"), Decimal("0"))
    return reserva.precio_total + costo_servicios - total_pagado


@router.get("/", response_model=list[PagoOut])
def listar_pagos(reserva_id: int, db: Session = Depends(get_db)):
    _obtener_reserva_o_404(db, reserva_id)
    return db.query(Pago).filter(Pago.reserva_id == reserva_id).all()


@router.post("/", response_model=PagoOut, status_code=status.HTTP_201_CREATED)
def registrar_pago(reserva_id: int, pago_in: PagoCreate, db: Session = Depends(get_db)):
    reserva = _obtener_reserva_o_404(db, reserva_id)
    if reserva.estado == "cancelada":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No se pueden registrar pagos sobre una reserva cancelada")

    saldo = _saldo_pendiente(reserva)
    if saldo <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La reserva no tiene saldo pendiente")
    if pago_in.monto > saldo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El monto supera el saldo pendiente ({saldo})",
        )

    nuevo_pago = Pago(reserva_id=reserva_id, monto=pago_in.monto, metodo_pago=pago_in.metodo_pago, estado="pagado")
    db.add(nuevo_pago)
    db.commit()
    db.refresh(nuevo_pago)
    return nuevo_pago