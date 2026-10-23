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
| Reservas | Pestañas por estado (incl. canceladas y “no se presentó”), búsqueda por huésped, teléfono, documento o código (HST-…), paginación; nueva reserva con búsqueda de huésped por teléfono, canal (recepción, teléfono, WhatsApp…), notas y búsqueda de disponibilidad; editar; confirmar, check-in, check-out, cancelar, no se presentó, eliminar (admin) | `/reservas`, `/disponibilidad`, `PUT /reservas/{id}`, `/reservas/{id}/confirmar\|checkin\|checkout\|cancelar\|no-show` |
| Pre-check-in (`/pre-checkin/:token`) | Página pública, sin sesión y pensada para celular: el huésped completa sus datos y los de sus acompañantes antes de llegar | `/publico/precheckin/{token}` |
| Cuenta del huésped (`/login?modo=registro`, `/mis-reservas`) | Crear cuenta desde el acceso; «Mis reservas» lista, paga y cancela las reservas de la cuenta. El personal que abre estas pantallas ve un aviso o va al panel | `/cuenta/*`, `/auth/login` |
| Reserva en línea (`/reservar`) | Página pública y pensada para celular: buscar fechas y elegir tipo de habitación es libre; **para dejar los datos y reservar hay que iniciar sesión con una cuenta de huésped** (se conserva la búsqueda). Consultar/cancelar con código + documento sigue sin sesión. Con anticipo opcional por Wompi (el pago ocurre en el sitio de Wompi y al volver se confirma). Solo funciona si el administrador la activa en Configuración | `/publico/hotel`, `/publico/disponibilidad`, `/publico/reservas` (+ `/consultar`, `/cancelar`, `/pagar`, `/verificar-pago`) |
| Detalle de reserva | Servicios consumidos (agregar/quitar), pagos, resumen de costos y saldo; pestaña Pre-check-in: crear/copiar el enlace (o enviarlo por WhatsApp), ver lo que envió el huésped y validarlo | `/reservas/{id}/servicios`, `/reservas/{id}/pagos`, `/reservas/{id}/resumen`, `/reservas/{id}/precheckin` | `/reservas/{id}/servicios`, `/reservas/{id}/pagos`, `/reservas/{id}/resumen` |
| Huéspedes | Registro, edición, perfil con historial de estadías, eliminar | `/huespedes`, `GET /reservas` |
| Habitaciones | Vista en tarjetas (con foto) o tabla; CRUD de habitaciones y tipos, filtro por estado, marcar limpieza → disponible | `/habitaciones`, `/tipos-habitacion` |
| Servicios | Consumos de todas las reservas, registrar consumo, catálogo CRUD | `/servicios`, `/reservas/{id}/servicios` |
| Configuración | Datos del hotel (nombre, NIT, dirección, contacto), horarios de check-in/out, horas para que venza una reserva pendiente, moneda y zona horaria. Todos consultan; solo el administrador guarda. El nombre aparece en el menú y la moneda en los montos | `/configuracion` |
| Roles | Tarjetas de roles con usuarios asignados y matriz de permisos por módulo (solo lectura, calculada por el backend); crear rol y editar descripción (administrador) | `/roles`, `/roles/permisos` |
| Usuarios | Solo administrador: lista con filtros y búsqueda, crear, editar, cambiar contraseña, activar/desactivar | `/usuarios`, `/usuarios/{id}/password`, `POST /auth/register`, `/roles` |

Todas las pantallas del mockup ya tienen su módulo.

## Enlaces públicos (pre-check-in y reservas en línea)

El enlace de pre-check-in que se le envía al huésped, y el de la página `/reservar` que muestra Configuración, se arman con el dominio desde el que abres el panel. En desarrollo
eso es `localhost`, que el huésped no puede abrir: para enlaces reales define en `.env`
`VITE_PUBLIC_URL=https://tu-dominio` (sin barra final) y vuelve a levantar el frontend.

## Pendientes del backend detectados

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
