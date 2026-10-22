"""Endpoints de salud para la API."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.api.deps import get_db

router = APIRouter(tags=["Salud"])


@router.get(
    "/health",
    summary="Verifica el estado de la API y la conexión a la base de datos",
    response_description="Estado de la API y de MySQL",
)
def health_check(db: Session = Depends(get_db)):
    """Ejecuta una consulta mínima (SELECT 1) contra MySQL para verificar la conexión."""
    db.execute(text("SELECT 1"))
    return {"status": "ok", "connected": True}