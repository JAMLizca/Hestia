"""
Punto de inicio de la API
"""
from fastapi import FastAPI

from app.api.routes import health, roles
from app.core.config import settings

app = FastAPI(
    title=settings.PROJECT_NAME,
    description=(
        "API REST del Sistema Inteligente de Gestión Hotelera Hestia. "
        "Gestiona huéspedes, habitaciones, reservas y servicios, y expone "
        "las predicciones y recomendaciones generadas por el componente "
        "de LM (Machine Learning)."
    ),
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.include_router(health.router, prefix=settings.API_V1_PREFIX)
app.include_router(roles.router, prefix=settings.API_V1_PREFIX)

@app.get("/", tags=["Raíz"], summary="Endpoint raíz")
def raiz():
    """Mensaje de bienvenida con un enlace a la documentación interactiva."""
    return {"mensaje": "Bienvenido a la API de Hestia", "documentacion": "/docs"}