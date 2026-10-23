"""
Webhook de Wompi: `POST /publico/wompi/eventos`.

Wompi avisa aquí cada cambio de estado de una transacción. El aviso solo se acepta si su checksum
coincide con el calculado con el secreto de eventos (ver app/core/wompi.py). Responde 200 cuando el aviso
es auténtico (aunque no sea de este sistema) para que Wompi no lo reintente.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core import wompi
from app.core.config import settings

log = logging.getLogger("hestia.wompi")

router = APIRouter(prefix="/publico/wompi", tags=["Pagos en línea (Wompi)"])


@router.post("/eventos", summary="Recibe los avisos de transacciones de Wompi")
async def recibir_evento(request: Request, db: Session = Depends(get_db)):
    if not settings.WOMPI_EVENTS_SECRET:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "El secreto de eventos de Wompi no está configurado")
    try:
        evento = await request.json()
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cuerpo inválido")
    if not isinstance(evento, dict) or not wompi.verificar_evento(evento):
        log.warning("Aviso de Wompi con checksum inválido")
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Checksum inválido")
    if evento.get("event") == "transaction.updated":
        tx = evento.get("data", {}).get("transaction")
        if isinstance(tx, dict):
            wompi.aplicar_transaccion(db, tx)
    return {"ok": True}
