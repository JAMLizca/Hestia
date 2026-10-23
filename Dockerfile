# ---- 1) Compila el frontend (React + Vite) ----
FROM node:22-slim AS frontend
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# Sin VITE_API_URL: el frontend llama a /api/v1 en el mismo dominio (lo sirve el propio backend).
RUN npm run build

# ---- 2) API + sitio compilado en un solo contenedor ----
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
COPY deploy ./deploy
COPY migraciones ./migraciones
COPY seed_roles.py ./
COPY --from=frontend /frontend/dist ./static
RUN chmod +x deploy/entrypoint.sh && useradd -m hestia && chown -R hestia /app
USER hestia
EXPOSE 8000
CMD ["./deploy/entrypoint.sh"]
