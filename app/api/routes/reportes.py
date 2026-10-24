"""
Reportes y exportación de datos. Solo administrador y gerente. Las reglas están en app/services/reportes.py.
"""
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.services import reportes as servicio

router = APIRouter(prefix="/reportes", tags=["Reportes"])


@router.get("/dataset-reservas", summary="Exporta el dataset de reservas para analítica y Machine Learning")
def dataset_reservas(
    formato: Literal["csv", "json"] = Query(default="csv"),
    desde: date | None = Query(default=None, description="Fecha de llegada mínima (inclusive)"),
    hasta: date | None = Query(default=None, description="Fecha de llegada máxima (inclusive)"),
    solo_cerradas: bool = Query(default=False, description="Solo reservas con desenlace conocido: checkout, cancelada o no_show"),
    db: Session = Depends(get_db),
):
    """
    Una fila por reserva con variables derivadas (noches, anticipación, temporada, preferencias, recurrencia…)
    y las etiquetas `cancelada` y `no_show`. Sin datos personales del huésped.
    """
    datos = servicio.filas(db, desde, hasta, solo_cerradas)
    if formato == "json":
        return datos
    # utf-8 con BOM para que Excel respete las tildes al abrir el archivo.
    contenido = "﻿" + servicio.a_csv(datos)
    return Response(
        content=contenido.encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="hestia_dataset_reservas_{date.today().isoformat()}.csv"'},
    )
