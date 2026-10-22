# Hestia

API REST del **Sistema Inteligente de Gestión Hotelera Hestia**, construida
con FastAPI, SQLAlchemy y MySQL. Incluye autenticación JWT con roles
(administrador, gerente, recepcionista), gestión de habitaciones, huéspedes y
reservas, consumo de servicios, pagos y facturación. El frontend (React + Vite)
está en la carpeta [`frontend/`](frontend/).

## Requisitos previos

- Python 3.11 o superior
- MySQL 8 corriendo localmente
- Node.js 18 o superior (solo para el frontend)
- Git

## Configuración del entorno de desarrollo

### 1. Crear y activar el entorno virtual

```bash
cd hestia
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

### 3. Configurar las variables de entorno

```bash
cp .env.example .env
```

Abrir `.env` y ajustar `DB_USER`, `DB_PASSWORD` y `DB_NAME` según tu
instalación local de MySQL. `SECRET_KEY` es obligatoria (mínimo 32 caracteres);
genera una con:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

`.env` está en `.gitignore` y nunca debe subirse al repositorio.

### 4. Crear la base de datos vacía

Desde el cliente de MySQL:

```sql
CREATE DATABASE hestia_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 5. Crear las tablas

Por ahora, mientras no se configura Alembic, las tablas se generan
directamente desde los modelos con este comando:

```bash
python -c "from app.db.base import Base; from app.db.session import engine; Base.metadata.create_all(bind=engine)"
```

Esto crea todas las tablas en `hestia_db`.

Después, crea los roles base y el primer administrador (el registro de
usuarios en `/auth/register` exige un administrador autenticado):

```bash
python seed_roles.py
```

El script pide nombre, email y contraseña del administrador, o los toma de
`ADMIN_NOMBRE`, `ADMIN_EMAIL` y `ADMIN_PASSWORD` si están definidas en `.env`.

### 6. Levantar el servidor de desarrollo

```bash
uvicorn app.main:app --reload
```

### 7. Probar la API

- Documentación interactiva (Swagger): http://localhost:8000/docs
- Documentación alternativa (ReDoc): http://localhost:8000/redoc
- Healthcheck: http://localhost:8000/api/v1/health

### 8. Levantar el frontend (opcional)

```bash
cd frontend
npm install
npm run dev
```

En desarrollo, Vite reenvía `/api/v1` al backend (`http://localhost:8000`),
por lo que no hace falta configurar CORS. Más detalles en
[`frontend/README.md`](frontend/README.md).

## Estructura del proyecto

```
hestia/
├── app/
│   ├── core/
│   │   ├── config.py            # Variables de entorno (pydantic-settings)
│   │   ├── permisos.py          # Matriz de permisos calculada desde las rutas
│   │   └── security.py          # Hash de contraseñas (bcrypt) y tokens JWT
│   ├── db/
│   │   ├── base_class.py        # Base declarativa de SQLAlchemy
│   │   ├── base.py              # Registro de todos los modelos (para Alembic)
│   │   └── session.py           # Engine, SessionLocal y dependencia get_db
│   ├── models/                  # Tablas SQLAlchemy
│   │   ├── role.py, usuario.py
│   │   ├── tipo_habitacion.py, habitacion.py
│   │   ├── huesped.py, reserva.py
│   │   └── servicio.py, reserva_servicio.py, pago.py
│   ├── schemas/                 # Esquemas Pydantic (entrada/salida de la API)
│   │   └── role, usuario, tipo_habitacion, habitacion, huesped, reserva,
│   │       servicio, reserva_servicio, pago, factura
│   ├── api/
│   │   ├── deps.py              # get_db, get_current_user, require_roles (RBAC)
│   │   └── routes/
│   │       ├── health.py, auth.py, roles.py, usuarios.py
│   │       ├── tipos_habitacion.py, habitaciones.py, disponibilidad.py
│   │       ├── huespedes.py, reservas.py
│   │       └── servicios.py, reserva_servicios.py, pagos.py, facturas.py
│   └── main.py                  # Instancia de FastAPI y registro de routers
├── frontend/                    # React + Vite
├── seed_roles.py                # Roles base y primer administrador
├── .env.example
├── .gitignore
├── requirements.txt
└── README.md
```

## Endpoints principales

Todos los endpoints (salvo `/health` y `/auth/login`) requieren el header
`Authorization: Bearer <token>`. Prefijo: `/api/v1`.

| Módulo | Endpoints | Quién puede escribir |
|--------|-----------|----------------------|
| Salud | `GET /health` | — |
| Autenticación | `POST /auth/login`, `GET /auth/me`, `POST /auth/register` | `register`: administrador |
| Roles | `GET/POST /roles/`, `PUT /roles/{id}` (solo la descripción), `GET /roles/permisos` | crear y editar: administrador. `permisos` devuelve la matriz módulo × acción × rol y los usuarios por rol |
| Usuarios | `GET /usuarios/`, `GET/PUT /usuarios/{id}`, `PUT /usuarios/{id}/password` | solo administrador (el alta es `POST /auth/register`) |
| Tipos de habitación | `GET/POST /tipos-habitacion/`, `GET/PUT/DELETE /tipos-habitacion/{id}` | administrador, gerente |
| Habitaciones | `GET/POST /habitaciones/`, `GET/PUT/DELETE /habitaciones/{id}` | crear/eliminar: administrador, gerente. Editar: también recepcionista, pero solo el `estado` |
| Disponibilidad | `GET /disponibilidad/?fecha_checkin=&fecha_checkout=` | — |
| Huéspedes | `GET/POST /huespedes/`, `GET/PUT/DELETE /huespedes/{id}` | cualquier usuario; eliminar: administrador, gerente |
| Reservas | `GET/POST /reservas/`, `GET/DELETE /reservas/{id}`, `POST /reservas/{id}/confirmar`, `/checkin`, `/checkout`, `/cancelar` | cualquier usuario; eliminar: administrador |
| Servicios (catálogo) | `GET/POST /servicios/`, `GET/PUT/DELETE /servicios/{id}` | administrador, gerente |
| Consumo de servicios | `GET/POST /reservas/{id}/servicios/`, `DELETE /reservas/{id}/servicios/{consumo_id}` | cualquier usuario |
| Pagos | `GET/POST /reservas/{id}/pagos/` | cualquier usuario |
| Facturación | `GET /reservas/{id}/resumen` | — |

## Reglas de negocio

- **Estados de una reserva:** `pendiente → confirmada → checkin → checkout`.
  Solo se puede cancelar desde `pendiente` o `confirmada`.
- **Habitación y reserva:** el check-in exige que la habitación esté
  `disponible` y la pasa a `ocupada`; el check-out la pasa a `limpieza`. Recepción
  debe marcarla `disponible` antes del siguiente check-in. Mientras haya una
  reserva en `checkin`, el estado de la habitación no se puede cambiar.
- **Solapamiento:** dos reservas de la misma habitación chocan si
  `A.checkin < B.checkout` y `B.checkin < A.checkout` (solo cuentan las
  `pendiente`, `confirmada` y `checkin`). Que una salga el mismo día que otra
  entra **no** es conflicto. Un choque devuelve `409`.
- **Validaciones al reservar:** la fecha de check-in no puede ser pasada y
  `num_huespedes` no puede superar la capacidad del tipo de habitación.
- **Precio:** `precio_base` del tipo de habitación × noches. El precio de cada
  servicio consumido se copia en el momento del consumo, así que un cambio
  posterior en el catálogo no altera facturas ya generadas.
- **Facturación:** `costo_total = costo_habitacion + costo_servicios`;
  `saldo_pendiente = costo_total − pagos`.
- **Pagos:** el monto debe ser mayor que 0 (máximo 10 dígitos y 2 decimales), no
  puede superar el saldo pendiente y no se aceptan pagos de una reserva cancelada.
- **Roles y permisos:** los permisos se asignan por nombre de rol con `require_roles` en cada ruta. `GET /roles/permisos` los calcula recorriendo las rutas reales, así que la pantalla de Roles siempre refleja lo que la API aplica (es de solo lectura). Un rol nuevo solo accede a las rutas abiertas a cualquier usuario autenticado. El nombre de un rol no se puede cambiar.
- **Usuarios:** no se eliminan, se desactivan (`activo: false`); un usuario inactivo no puede iniciar sesión y su token deja de funcionar de inmediato. Un administrador no puede desactivarse ni cambiarse el rol a sí mismo, y siempre debe quedar al menos un administrador activo.
- **Borrados:** no se eliminan tipos de habitación, habitaciones, huéspedes,
  servicios ni reservas que tengan registros asociados.