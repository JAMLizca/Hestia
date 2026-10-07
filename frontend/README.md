# Hestia — Frontend

Panel web de Hestia en **React + Vite**. Consume la API FastAPI existente
(`/api/v1`) sin modificarla.

## Requisitos

- Node.js 18 o superior
- Backend de Hestia corriendo en `http://localhost:8000`

## Iniciar en desarrollo

```bash
cd frontend
npm install
cp .env.example .env   # opcional: cambiar VITE_BACKEND_URL si la API no está en :8000
npm run dev
```

Abrir `http://localhost:5173`. Vite reenvía `/api/v1` al backend (el backend
no tiene CORS configurado, por eso se usa el proxy).

Para entrar se necesita un usuario creado con `POST /api/v1/auth/register`.

### Probar sin el backend (API de prueba)

`mock-api.mjs` es un servidor **solo para pruebas locales** (está en
`.gitignore`, no se sube). Replica las rutas, mensajes y reglas del backend
con datos de ejemplo en memoria.

```bash
node mock-api.mjs      # terminal 1 (puerto 8000)
npm run dev            # terminal 2
```

Contraseña: `secreta123`. Cualquier correo entra como administrador; un correo
que empiece por `recepcion` entra como recepcionista (para probar permisos).

## Módulos implementados

| Pantalla | Funcionalidad | Endpoints usados |
|---|---|---|
| Landing (`/`) | Página pública del mockup: secciones, diagrama de arquitectura, acceso al panel | — |
| Login | Inicio de sesión JWT, sesión persistente, cierre de sesión | `POST /auth/login`, `GET /auth/me` |
| Dashboard | Indicadores del día, estado de habitaciones, reservas recientes, ocupación semanal, acciones rápidas, actividad reciente | `GET /reservas`, `/habitaciones`, `/huespedes`, `/servicios` |
| Reservas | Filtros, búsqueda, paginación; nueva reserva con búsqueda de disponibilidad; confirmar, check-in, check-out, cancelar, eliminar (admin) | `/reservas`, `/disponibilidad`, `/reservas/{id}/confirmar\|checkin\|checkout\|cancelar` |
| Detalle de reserva | Servicios consumidos (agregar/quitar), pagos, resumen de costos y saldo | `/reservas/{id}/servicios`, `/reservas/{id}/pagos`, `/reservas/{id}/resumen` |
| Huéspedes | Registro, edición, perfil con historial de estadías, eliminar | `/huespedes`, `GET /reservas` |
| Habitaciones | Vista en tarjetas (con foto) o tabla; CRUD de habitaciones y tipos, filtro por estado, marcar limpieza → disponible | `/habitaciones`, `/tipos-habitacion` |
| Servicios | Consumos de todas las reservas, registrar consumo, catálogo CRUD | `/servicios`, `/reservas/{id}/servicios` |

**Pendientes por falta de endpoints:** Usuarios, Roles (matriz de permisos) y
Configuración. La pantalla de cada uno explica qué falta en el backend.

## Pendientes del backend detectados

- `app/schemas/pago.py` en `main` tiene el contenido de la factura y falta
  `app/schemas/factura.py`: la API no arranca. La rama
  `agents/frontend-html-css-react-implementation` tiene la corrección.
- `DELETE /habitaciones/{habitacion_idz}`: el nombre del parámetro no coincide,
  así que eliminar una habitación responde 422.
- No existe `PUT /reservas/{id}`: el botón "Editar" del mockup se reemplazó
  por la siguiente acción de estado disponible.
- Los consumos de servicio no tienen estado (pendiente / en proceso /
  completado) como muestra el mockup de Servicios.
- No hay endpoint global de consumos: el frontend los pide reserva por reserva.

## Diseño responsive

Todas las pantallas funcionan en móvil (desde 360 px), tablet y escritorio:
en móvil las tablas se muestran como tarjetas, los formularios se abren como
hoja inferior y el menú lateral se despliega desde el botón del encabezado.

## Imágenes

En `src/assets/`: logo circular (menú, login, favicon), logo completo (login,
landing), foto de habitación (tarjetas de Habitaciones) y diagrama de
arquitectura (landing). El backend no guarda fotos por habitación, así que
todas las tarjetas usan la misma foto general.

## Estructura

```
src/
├── api/            client.js (fetch + JWT + errores) y services.js (1 función por endpoint)
├── context/        AuthContext (sesión) y ToastContext (avisos)
├── hooks/          useApiData (carga en paralelo + recarga)
├── components/
│   ├── layout/     AppLayout, Sidebar, Header, ProtectedRoute, navigation.js
│   └── ui/         Tarjetas, indicadores, pestañas, tablas, badges, modal, panel lateral, formularios
├── features/       Formularios y paneles por dominio (reservas, huespedes, habitaciones, servicios)
├── pages/          Una página por pantalla del mockup
├── styles/         global.css con los tokens de diseño del mockup
└── utils/          Formato, estados y cálculos derivados (ocupación, historial, actividad)
```
