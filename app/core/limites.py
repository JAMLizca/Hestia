"""
Límite de peticiones para las rutas públicas (sin sesión).

Es en memoria y por dirección IP: frena los intentos de adivinar tokens o de saturar el formulario
sin depender de nada externo. Si la API corre en varios procesos, cada uno lleva su propia cuenta
(el límite real es entonces un múltiplo); para algo más estricto conviene limitar en el proxy.
"""
import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import HTTPException, Request, status

VENTANA_SEGUNDOS = 60
MAX_PETICIONES = 40  # por IP y minuto
MAX_FALLOS = 8  # tokens inválidos por IP y minuto

_peticiones: dict[str, deque] = defaultdict(deque)
_fallos: dict[str, deque] = defaultdict(deque)
_candado = Lock()


def _purgar(cola: deque, ahora: float) -> None:
    while cola and ahora - cola[0] > VENTANA_SEGUNDOS:
        cola.popleft()


def _ip(request: Request) -> str:
    return request.client.host if request.client else "desconocida"


def limitar_publico(request: Request) -> None:
    """Dependencia de las rutas públicas: 429 si una IP excede el ritmo permitido."""
    ip, ahora = _ip(request), time.monotonic()
    with _candado:
        peticiones, fallos = _peticiones[ip], _fallos[ip]
        _purgar(peticiones, ahora)
        _purgar(fallos, ahora)
        if len(peticiones) >= MAX_PETICIONES or len(fallos) >= MAX_FALLOS:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Demasiados intentos. Espera un minuto e inténtalo de nuevo.",
            )
        peticiones.append(ahora)
        # Evita que el diccionario crezca sin límite con IPs que ya no consultan.
        if len(_peticiones) > 5000:
            for clave in [k for k, c in _peticiones.items() if not c]:
                _peticiones.pop(clave, None)
                _fallos.pop(clave, None)


MAX_CREACIONES = 5  # reservas en línea por IP cada 10 minutos
VENTANA_CREACION = 600
_creaciones: dict[str, deque] = defaultdict(deque)


def limitar_creacion(request: Request) -> None:
    """Dependencia de POST /publico/reservas: cada reserva bloquea una habitación hasta que vence o se confirma.

    Solo cuentan las reservas realmente creadas (ver `registrar_creacion`), para no castigar errores de digitación.
    """
    ip, ahora = _ip(request), time.monotonic()
    with _candado:
        cola = _creaciones[ip]
        while cola and ahora - cola[0] > VENTANA_CREACION:
            cola.popleft()
        if len(cola) >= MAX_CREACIONES:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Has hecho varias reservas seguidas. Espera unos minutos o comunícate con el hotel.",
            )


def registrar_creacion(request: Request) -> None:
    with _candado:
        _creaciones[_ip(request)].append(time.monotonic())



def registrar_fallo(request: Request) -> None:
    with _candado:
        _fallos[_ip(request)].append(time.monotonic())


def reiniciar() -> None:
    """Solo para pruebas."""
    with _candado:
        _peticiones.clear()
        _fallos.clear()
        _creaciones.clear()
