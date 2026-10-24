"""
Pagos asociados a una reserva. Una reserva puede tener varios pagos.
Registrar: cualquier usuario autenticado. Corregir o anular: administrador o gerente.
Las reglas están en app/services/pagos.py.
"""
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.schemas.pago import PagoAnular, PagoCreate, PagoOut, PagoUpdate
from app.services import pagos as servicio

router = APIRouter(prefix="/reservas/{reserva_id}/pagos", tags=["Pagos"], dependencies=[Depends(get_current_user)])



@router.get("/", response_model=list[PagoOut])
def listar_pagos(reserva_id: int, db: Session = Depends(get_db)):
    return servicio.listar(db, reserva_id)


@router.post("/", response_model=PagoOut, status_code=status.HTTP_201_CREATED)
def registrar_pago(reserva_id: int, pago_in: PagoCreate, db: Session = Depends(get_db)):
    return servicio.registrar(db, reserva_id, pago_in)


@router.put("/{pago_id}", response_model=PagoOut, summary="Corrige el monto o el método de un pago manual (administrador/gerente)")
def editar_pago(reserva_id: int, pago_id: int, datos: PagoUpdate, db: Session = Depends(get_db)):
    """Solo pagos manuales en estado 'pagado'. Los de Wompi se devuelven desde el panel de la pasarela (409)."""
    return servicio.editar(db, reserva_id, pago_id, datos)


@router.post("/{pago_id}/anular", response_model=PagoOut, summary="Anula un pago manual dejando el motivo (administrador/gerente)")
def anular_pago(reserva_id: int, pago_id: int, datos: PagoAnular, db: Session = Depends(get_db)):
    """El pago no se borra: queda 'anulado' con su motivo y deja de sumar al total pagado."""
    return servicio.anular(db, reserva_id, pago_id, datos)
