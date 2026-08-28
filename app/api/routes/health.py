"""Endpoints de salud para la API."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.api.deps import get_db

router = APIRouter(tags=["Salud"])

@router.get("/health"
            summary="Estado de la API y conexión a la DB",
            response_description="Estado de la API y conexión a la DB")

def health_check(db: Session = Depends(get_db)):

            """Ejecuta consulta (SELECT 1) mínima contra Mysql para verificar la conexión a la base de datos."""

            db.execute(text("SELECT 1"))
            return {"status": "ok", "connected :v": True}


