"""
Punto de inicio de la API
"""
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.exc import IntegrityError, OperationalError

from app.api.routes import (
    auth,
    cuenta,
    configuracion,
    disponibilidad,
    facturas,
    habitaciones,
    health,
    huespedes,
    pagos,
    precheckin,
    prediccion,
    recomendacion,
    reserva_servicios,
    reservas,
    reportes,
    reservas_web,
    wompi,
    roles,
    servicios,
    tipos_habitacion,
    usuarios,
)
from fastapi import Depends

from app.api.deps import verificar_permiso
from app.core.config import settings
from app.core.errores import ErrorInterno, ErrorNegocio

app = FastAPI(
    title=settings.PROJECT_NAME,
    description=(
        "API REST del Sistema Inteligente de Gestión Hotelera Hestia. "
        "Gestiona huéspedes, habitaciones, reservas y servicios, y expone "
        "las predicciones y recomendaciones generadas por el componente "
        "de Machine Learning."
    ),
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    dependencies=[Depends(verificar_permiso)],  # tabla de permisos por rol (app/core/permisos.py)
)

@app.exception_handler(ErrorNegocio)
async def _error_de_negocio(request: Request, exc: ErrorNegocio):
    return JSONResponse(status_code=exc.codigo_http, content={"detail": exc.detalle}, headers=exc.cabeceras)


@app.exception_handler(ErrorInterno)
async def _error_interno(request: Request, exc: ErrorInterno):
    return JSONResponse(status_code=500, content={"detail": str(exc)})


_MENSAJE_INTEGRIDAD = "La operación choca con las reglas de integridad de los datos. Revisa la información e inténtalo de nuevo."
# Una restricción CHECK violada: MySQL 8 responde 3819 y MariaDB 4025 (según el conector llegan como OperationalError).
_CODIGOS_CHECK = (3819, 4025)


@app.exception_handler(IntegrityError)
async def _restriccion_de_base_de_datos(request: Request, exc: IntegrityError):
    # Red de seguridad: los servicios validan antes, pero si la base rechaza algo no debe verse como un error 500 opaco.
    return JSONResponse(status_code=409, content={"detail": _MENSAJE_INTEGRIDAD})


@app.exception_handler(OperationalError)
async def _error_operativo_de_base_de_datos(request: Request, exc: OperationalError):
    codigo = exc.orig.args[0] if getattr(exc.orig, "args", None) else None
    if codigo in _CODIGOS_CHECK:
        return JSONResponse(status_code=409, content={"detail": _MENSAJE_INTEGRIDAD})
    return JSONResponse(status_code=500, content={"detail": "Error al acceder a la base de datos"})


app.include_router(health.router, prefix=settings.API_V1_PREFIX)
app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
app.include_router(roles.router, prefix=settings.API_V1_PREFIX)
app.include_router(configuracion.router, prefix=settings.API_V1_PREFIX)
app.include_router(tipos_habitacion.router, prefix=settings.API_V1_PREFIX)
app.include_router(habitaciones.router, prefix=settings.API_V1_PREFIX)
app.include_router(huespedes.router, prefix=settings.API_V1_PREFIX)
app.include_router(reservas.router, prefix=settings.API_V1_PREFIX)
app.include_router(disponibilidad.router, prefix=settings.API_V1_PREFIX)
app.include_router(servicios.router, prefix=settings.API_V1_PREFIX)
app.include_router(reserva_servicios.router, prefix=settings.API_V1_PREFIX)
app.include_router(pagos.router, prefix=settings.API_V1_PREFIX)
app.include_router(facturas.router, prefix=settings.API_V1_PREFIX)
app.include_router(usuarios.router, prefix=settings.API_V1_PREFIX)
app.include_router(precheckin.router, prefix=settings.API_V1_PREFIX)
app.include_router(precheckin.publico, prefix=settings.API_V1_PREFIX)
app.include_router(reservas_web.router, prefix=settings.API_V1_PREFIX)
app.include_router(cuenta.router, prefix=settings.API_V1_PREFIX)
app.include_router(wompi.router, prefix=settings.API_V1_PREFIX)
app.include_router(reportes.router, prefix=settings.API_V1_PREFIX)
app.include_router(prediccion.router, prefix=settings.API_V1_PREFIX)
app.include_router(recomendacion.router, prefix=settings.API_V1_PREFIX)


# Si existe la carpeta `static/` (el frontend ya compilado, como en el despliegue con Docker), la API
# también sirve el sitio: así navegador y API comparten origen y no hace falta CORS.
STATIC_DIR = Path(__file__).resolve().parent.parent / "static"

if (STATIC_DIR / "index.html").is_file():

    @app.get("/{ruta:path}", include_in_schema=False)
    def sitio(ruta: str):
        if ruta.startswith(("api/", "docs", "redoc", "openapi.json")):
            raise HTTPException(status_code=404, detail="No encontrado")
        archivo = (STATIC_DIR / ruta).resolve()
        if ruta and archivo.is_file() and STATIC_DIR in archivo.parents:
            return FileResponse(archivo)
        return FileResponse(STATIC_DIR / "index.html")  # rutas de React Router (/reservar, /login…)

else:

    @app.get("/", tags=["Raíz"])
    def raiz():
        return {"mensaje": "Bienvenido a la API de Hestia", "documentacion": "/docs"}
