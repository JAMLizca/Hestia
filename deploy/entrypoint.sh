#!/bin/sh
set -e
python deploy/inicializar.py
# --proxy-headers: detrás del proxy de la plataforma, request.client.host es la IP real del visitante
# (los límites por IP del login y las reservas dependen de esto).
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --proxy-headers --forwarded-allow-ips="*"
