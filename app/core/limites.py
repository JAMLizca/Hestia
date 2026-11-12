"""
Límite de peticiones para las rutas públicas (sin sesión).
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



MAX_FALLOS_LOGIN = 10 
VENTANA_LOGIN = 300
# Además de la IP se cuenta por cuenta: detrás de un proxy la IP llega en una
# cabecera que el cliente controla, así que rotándola se esquiva el límite por IP.
# El correo va en el cuerpo de la petición y no se puede falsear igual.
MAX_FALLOS_CUENTA = 10
MAX_REGISTROS = 10  
VENTANA_REGISTRO = 3600
_fallos_login: dict[str, deque] = defaultdict(deque)
_registros: dict[str, deque] = defaultdict(deque)


def _bloquear_si_excede(cola: deque, ahora: float, ventana: int, maximo: int, mensaje: str) -> None:
    while cola and ahora - cola[0] > ventana:
        cola.popleft()
    if len(cola) >= maximo:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=mensaje)


_fallos_cuenta: dict[str, deque] = defaultdict(deque)
_AVISO_LOGIN = "Demasiados intentos fallidos. Espera unos minutos e inténtalo de nuevo."


def _clave_cuenta(email: str | None) -> str:
    return (email or "").strip().lower()


def limitar_login(request: Request) -> None:
    with _candado:
        _bloquear_si_excede(
            _fallos_login[_ip(request)], time.monotonic(), VENTANA_LOGIN, MAX_FALLOS_LOGIN, _AVISO_LOGIN,
        )


def limitar_login_cuenta(email: str | None) -> None:
    """Se llama ya dentro de la ruta, cuando el cuerpo del formulario está leído."""
    clave = _clave_cuenta(email)
    if not clave:
        return
    with _candado:
        _bloquear_si_excede(_fallos_cuenta[clave], time.monotonic(), VENTANA_LOGIN, MAX_FALLOS_CUENTA, _AVISO_LOGIN)


def registrar_fallo_login(request: Request, email: str | None = None) -> None:
    ahora = time.monotonic()
    with _candado:
        _fallos_login[_ip(request)].append(ahora)
        clave = _clave_cuenta(email)
        if clave:
            _fallos_cuenta[clave].append(ahora)
        if len(_fallos_cuenta) > 5000:  # evita que el diccionario crezca sin límite
            for k in [k for k, c in _fallos_cuenta.items() if not c or ahora - c[-1] > VENTANA_LOGIN]:
                _fallos_cuenta.pop(k, None)


def limpiar_fallos_cuenta(email: str | None) -> None:
    """Un inicio de sesión correcto borra los fallos acumulados de esa cuenta."""
    with _candado:
        _fallos_cuenta.pop(_clave_cuenta(email), None)


def limitar_registro(request: Request) -> None:
    with _candado:
        _bloquear_si_excede(
            _registros[_ip(request)], time.monotonic(), VENTANA_REGISTRO, MAX_REGISTROS,
            "Se crearon varias cuentas desde esta conexión. Inténtalo más tarde o comunícate con el hotel.",
        )


def registrar_registro(request: Request) -> None:
    with _candado:
        _registros[_ip(request)].append(time.monotonic())


def registrar_fallo(request: Request) -> None:
    with _candado:
        _fallos[_ip(request)].append(time.monotonic())


def reiniciar() -> None:
    with _candado:
        _peticiones.clear()
        _fallos.clear()
        _creaciones.clear()
        _fallos_login.clear()
        _registros.clear()
