"""
Integración con Wompi (pasarela de pagos de Bancolombia) mediante su Web Checkout.

Flujo:
  1. El servidor crea un `Pago` en estado `pendiente` con una referencia única y arma el enlace de pago
     firmado (`url_checkout`). El huésped paga en el sitio de Wompi; nunca se tocan datos de tarjeta aquí.
  2. Wompi avisa el resultado al webhook `POST /publico/wompi/eventos` (verificado con `verificar_evento`).
     Si el aviso no llega (p. ej. en desarrollo, donde Wompi no puede llamar a localhost), cuando el
     huésped vuelve el frontend pide `POST /publico/reservas/verificar-pago`, que consulta la transacción
     directamente a Wompi (`consultar_transaccion`).
  3. Ambos caminos terminan en `aplicar_transaccion`, que es idempotente: pasa el pago a `pagado` y
     confirma la reserva.

Documentación: https://docs.wompi.co
"""
import hashlib
import hmac
import json
import logging
import secrets
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from decimal import ROUND_UP, Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.pago import Pago
from app.models.reserva import Reserva

log = logging.getLogger("hestia.wompi")

CHECKOUT_URL = "https://checkout.wompi.co/p/"
VIGENCIA_ENLACE_MIN = 60  # minutos que el enlace de pago sigue siendo válido
MONEDA = "COP"  # Wompi solo cobra en pesos colombianos

ESTADOS_RECHAZO = {"DECLINED": "rechazado", "ERROR": "rechazado", "VOIDED": "anulado"}


def anticipo(total: Decimal, porcentaje: int) -> Decimal:
    """Anticipo en pesos enteros (se redondea hacia arriba) y nunca mayor que el total."""
    return min(total, (total * porcentaje / 100).to_integral_value(rounding=ROUND_UP))


def _sha256(texto: str) -> str:
    return hashlib.sha256(texto.encode("utf-8")).hexdigest()


def centavos(monto: Decimal) -> int:
    return int((monto * 100).to_integral_value())


def nueva_referencia(codigo_reserva: str) -> str:
    return f"{codigo_reserva}-{secrets.token_hex(3).upper()}"


def url_checkout(*, referencia: str, monto: Decimal, redirect_url: str, email: str | None = None, nombre: str | None = None) -> str:
    """Enlace del Web Checkout firmado con el secreto de integridad (ver docs.wompi.co, «Web Checkout»)."""
    expira = (datetime.now(timezone.utc) + timedelta(minutes=VIGENCIA_ENLACE_MIN)).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    cents = centavos(monto)
    firma = _sha256(f"{referencia}{cents}{MONEDA}{expira}{settings.WOMPI_INTEGRITY_SECRET}")
    params = {
        "public-key": settings.WOMPI_PUBLIC_KEY,
        "currency": MONEDA,
        "amount-in-cents": cents,
        "reference": referencia,
        "signature:integrity": firma,
        "redirect-url": redirect_url,
        "expiration-time": expira,
    }
    if email:
        params["customer-data:email"] = email
    if nombre:
        params["customer-data:full-name"] = nombre
    return f"{CHECKOUT_URL}?{urllib.parse.urlencode(params)}"


# ── Avisos (webhook) ────────────────────────────────────────────────────────

def _valor(data: dict, ruta: str):
    for parte in ruta.split("."):
        if not isinstance(data, dict) or parte not in data:
            return ""
        data = data[parte]
    return data


def checksum_evento(evento: dict, secreto: str) -> str:
    """SHA-256 de: valores de `signature.properties` (en ese orden) + timestamp + secreto de eventos."""
    props = evento.get("signature", {}).get("properties", [])
    texto = "".join(str(_valor(evento.get("data", {}), p)) for p in props) + str(evento.get("timestamp", "")) + secreto
    return _sha256(texto)


def verificar_evento(evento: dict, secreto: str | None = None) -> bool:
    secreto = settings.WOMPI_EVENTS_SECRET if secreto is None else secreto
    recibido = str(evento.get("signature", {}).get("checksum", ""))
    if not secreto or not recibido:
        return False
    return hmac.compare_digest(checksum_evento(evento, secreto).upper(), recibido.upper())


# ── Consulta directa a Wompi ────────────────────────────────────────────────

class WompiNoDisponible(Exception):
    pass


def consultar_transaccion(transaccion_id: str) -> dict:
    """GET /transactions/{id} (endpoint público de Wompi). Devuelve el objeto `data` de la transacción."""
    url = f"{settings.WOMPI_API_URL}/transactions/{urllib.parse.quote(transaccion_id, safe='')}"
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"Accept": "application/json"}), timeout=10) as r:
            return json.load(r)["data"]
    except (urllib.error.URLError, TimeoutError, ValueError, KeyError) as exc:
        log.warning("No se pudo consultar la transacción %s: %s", transaccion_id, exc)
        raise WompiNoDisponible from exc


# ── Resultado de una transacción ────────────────────────────────────────────

def _nota_reembolso(reserva: Reserva, referencia: str) -> None:
    alerta = f"⚠ Pago en línea recibido ({referencia}) con la reserva cancelada: reembolsar al huésped."
    if alerta in (reserva.notas or ""):
        return
    reserva.notas = f"{alerta} {reserva.notas or ''}".strip()[:500]


def _reactivar_si_libre(db: Session, reserva: Reserva) -> bool:
    """Una reserva que venció mientras el huésped pagaba se reactiva si su habitación sigue libre."""
    from app.api.routes.reservas import ESTADOS_QUE_BLOQUEAN

    choque = (
        db.query(Reserva.id)
        .filter(
            Reserva.id != reserva.id,
            Reserva.habitacion_id == reserva.habitacion_id,
            Reserva.estado.in_(ESTADOS_QUE_BLOQUEAN),
            Reserva.fecha_checkin_prevista < reserva.fecha_checkout_prevista,
            Reserva.fecha_checkout_prevista > reserva.fecha_checkin_prevista,
        )
        .first()
    )
    if choque:
        return False
    reserva.estado = "confirmada"
    reserva.motivo_cancelacion = None
    return True


def aplicar_transaccion(db: Session, tx: dict) -> Pago | None:
    """
    Aplica el resultado de una transacción de Wompi a su `Pago` (idempotente). Devuelve el pago, o None si la
    referencia no es de este sistema o el monto no coincide (en ese caso no se confirma nada).
    """
    referencia = str(tx.get("reference", ""))
    pago = db.query(Pago).filter(Pago.referencia == referencia).with_for_update().first()
    if pago is None:
        return None
    if tx.get("amount_in_cents") != centavos(pago.monto) or tx.get("currency", MONEDA) != MONEDA:
        log.warning("Transacción %s: el monto no coincide con el pago %s; se ignora", tx.get("id"), pago.id)
        return None

    estado = str(tx.get("status", ""))
    reserva = pago.reserva
    if estado == "APPROVED":
        if pago.estado != "pagado":
            pago.estado = "pagado"
            pago.transaccion_id = str(tx.get("id", ""))[:64]
            pago.fecha_pago = func.now()
        if reserva.estado == "pendiente":
            reserva.estado = "confirmada"
        elif reserva.estado == "cancelada":
            vencida = (reserva.motivo_cancelacion or "").startswith("Vencida")
            if not (vencida and _reactivar_si_libre(db, reserva)):
                _nota_reembolso(reserva, referencia)
    elif estado in ESTADOS_RECHAZO:
        nuevo = ESTADOS_RECHAZO[estado]
        # Un pago aprobado solo se revierte si Wompi lo anula (devolución); un rechazo no lo toca.
        if pago.estado == "pendiente" or (pago.estado == "pagado" and estado == "VOIDED"):
            pago.estado = nuevo
            pago.transaccion_id = str(tx.get("id", ""))[:64] or pago.transaccion_id
    db.commit()
    return pago
