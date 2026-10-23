"""
Errores de negocio. Los servicios (app/services) los lanzan sin saber nada de HTTP;
`main.py` los convierte en la respuesta {"detail": "..."} con el código que corresponda.
"""


class ErrorNegocio(Exception):
    codigo_http = 400
    cabeceras: dict[str, str] | None = None

    def __init__(self, detalle: str):
        super().__init__(detalle)
        self.detalle = detalle


class SolicitudInvalida(ErrorNegocio):
    codigo_http = 400


class NoAutenticado(ErrorNegocio):
    codigo_http = 401
    cabeceras = {"WWW-Authenticate": "Bearer"}


class Prohibido(ErrorNegocio):
    codigo_http = 403


class NoEncontrado(ErrorNegocio):
    codigo_http = 404


class Conflicto(ErrorNegocio):
    codigo_http = 409


class Caducado(ErrorNegocio):
    codigo_http = 410


class DemasiadasSolicitudes(ErrorNegocio):
    codigo_http = 429


class ServicioNoDisponible(ErrorNegocio):
    codigo_http = 503


class PasarelaNoDisponible(ErrorNegocio):
    codigo_http = 502


class ErrorInterno(Exception):
    """Falla inesperada del sistema (se responde 500)."""
