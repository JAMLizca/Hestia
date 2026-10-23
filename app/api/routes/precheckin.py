"""
Pre-check-in: el huésped completa su registro desde un enlace antes de llegar y recepción lo valida.
Las reglas están en app/services/precheckin.py.

Dos grupos de rutas:
- /reservas/{id}/precheckin (con sesión): recepción genera el enlace, ve lo que envió el huésped y lo valida.
- /publico/precheckin/{token} (sin sesión): lo que abre el huésped. El token es el único secreto, por eso las
  rutas públicas tienen límite de peticiones y no revelan nada sobre enlaces inválidos.
"""
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, liberar_pendientes_vencidas
from app.core.errores import NoEncontrado
from app.core.limites import limitar_publico, registrar_fallo
from app.models.precheckin import PreCheckin
from app.models.usuario import Usuario
from app.schemas.precheckin import PreCheckinEnvio, PreCheckinOut, PreCheckinPublico, ValidarPreCheckin
from app.services import precheckin as servicio
from app.services.precheckin import ESTADOS_ADMITEN  # noqa: F401 (compatibilidad)

router = APIRouter(prefix="/reservas/{reserva_id}/precheckin", tags=["Pre-check-in"], dependencies=[Depends(get_current_user)])

publico = APIRouter(
    prefix="/publico/precheckin",
    tags=["Pre-check-in (público)"],
    dependencies=[Depends(limitar_publico), Depends(liberar_pendientes_vencidas)],
)


# ── Recepción ───────────────────────────────────────────────────────────────

@router.get("/", response_model=PreCheckinOut | None, summary="Pre-check-in de la reserva (null si aún no se creó el enlace)")
def obtener_precheckin(reserva_id: int, db: Session = Depends(get_db)):
    return servicio.obtener(db, reserva_id)


@router.post(
    "/",
    response_model=PreCheckinOut,
    status_code=status.HTTP_201_CREATED,
    summary="Crea el enlace de pre-check-in o genera uno nuevo (el anterior deja de funcionar)",
)
def crear_precheckin(reserva_id: int, db: Session = Depends(get_db)):
    return servicio.crear(db, reserva_id)


@router.post("/validar", response_model=PreCheckinOut, summary="Valida lo que envió el huésped y lo aplica a su registro")
def validar_precheckin(
    reserva_id: int,
    opciones: ValidarPreCheckin | None = None,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(get_current_user),
):
    return servicio.validar(db, reserva_id, opciones, usuario)


# ── Huésped (sin sesión) ────────────────────────────────────────────────────

def _resolver(db: Session, token: str, request: Request) -> PreCheckin:
    """Un enlace que no existe cuenta como intento fallido (límite por IP contra la adivinación de tokens)."""
    try:
        return servicio.resolver(db, token)
    except NoEncontrado:
        registrar_fallo(request)
        raise


@publico.get("/{token}", response_model=PreCheckinPublico, summary="Datos de la reserva para el formulario del huésped")
def ver_publico(token: str, request: Request, db: Session = Depends(get_db)):
    return servicio.vista_publica(db, _resolver(db, token, request))


@publico.put("/{token}", response_model=PreCheckinPublico, summary="El huésped envía (o corrige) su registro")
def enviar_publico(token: str, envio: PreCheckinEnvio, request: Request, db: Session = Depends(get_db)):
    return servicio.enviar(db, _resolver(db, token, request), envio)
