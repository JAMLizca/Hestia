# Hestia 

API REST del **Sistema Inteligente de Gestión Hotelera Hestia**, construida
con FastAPI, SQLAlchemy y MySQL.

## Requisitos previos

- Python 3.11 o superior
- MySQL 8 corriendo localmente
- Git

## Configuración del entorno de desarrollo

### 1. Crear y activar el entorno virtual

```bash
cd hestia-backend
python -m venv venv

# Linux / macOS
source venv/bin/activate

# Windows (PowerShell)
venv\Scripts\Activate.ps1
```

### 2. Instalar dependencias

```bash
pip install -r requirements.txt
```

### 3. Configurar las variables de etorno

```bash
cp .env.example .env
```

Abrir `.env` y ajustar `DB_USER`, `DB_PASSWORD` y `DB_NAME` según tu
instalación local de MySQL.

### 4. Crear la base de datos vacía

Desde el cliente de MySQL:

```sql
CREATE DATABASE hestia_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 5. Crear las tablas 

Por ahora, mientras no se configura Alembic, las tablas se
generan directamente desde los modelos con este script chicos de manera rápida:

```bash
python -c "from app.db.base import Base; from app.db.session import engine; Base.metadata.create_all(bind=engine)"
```

Esto crea la tabla `roles` en `hestia_db`.

### 6. Levantar el servidor de desarrollo

```bash
uvicorn app.main:app --reload
```

### 7. Probar la API

- Documentación interactiva (Swagger): http://localhost:8000/docs
- Documentación alternativa (ReDoc): http://localhost:8000/redoc
- Healthcheck: http://localhost:8000/api/v1/health
- Roles: http://localhost:8000/api/v1/roles/

## Estructura del proyecto

```
hestia/
├── app/
│   ├── core/
│   │   └── config.py        # Variables de entorno (pydantic-settings)
│   ├── db/
│   │   ├── base_class.py    # Base declarativa de SQLAlchemy
│   │   ├── base.py          # Registro de todos los modelos (para Alembic)
│   │   └── session.py       # Engine, SessionLocal y dependencia get_db
│   ├── models/
│   │   └── role.py          # Modelo SQLAlchemy de la tabla roles
│   ├── schemas/
│   │   └── role.py          # Esquemas Pydantic (entrada/salida de la API)
│   ├── api/
│   │   ├── deps.py          # Dependencias compartidas (get_db, futuro auth)
│   │   └── routes/
│   │       ├── health.py    # GET /health
│   │       └── roles.py     # GET/POST /roles
│   └── main.py               # Instancia de FastAPI y registro de routers
├── .env.example
├── .gitignore
├── requirements.txt
└── README.md
```

## Primer endpoint documentado

Se eligió la entidad `Role` como primer módulo porque es la tabla más
simple del modelo E-R (sin llaves foráneas propias), lo que permite validar
el flujo completo:
- modelo SQLAlchemy → esquema Pydantic → sesión de base
de datos → endpoint — antes de construir los módulos más complejos.

| Método | Ruta                | Descripción                        |
|--------|---------------------|-------------------------------------|
| GET    | `/api/v1/health`    | Verifica que la API y MySQL responden |
| GET    | `/api/v1/roles/`    | Lista todos los roles               |
| POST   | `/api/v1/roles/`    | Crea un rol nuevo                   |

Ambos routers quedan documentados automáticamente en `/docs` gracias a los
`summary` y docstrings de cada función. Hacer pruebas.