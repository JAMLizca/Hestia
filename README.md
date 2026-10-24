# Hestia

API REST del **Sistema Inteligente de Gestión Hotelera Hestia**, construida
con FastAPI, SQLAlchemy y MySQL. Incluye autenticación JWT con roles
(administrador, gerente, recepcionista), gestión de habitaciones, huéspedes y
reservas, consumo de servicios, pagos y facturación. El frontend (React + Vite)
está en la carpeta [`frontend/`](frontend/).

## Requisitos previos

- Python 3.11 o superior
- MySQL 8.0.16 o superior (o MariaDB 10.2+) corriendo localmente: las versiones anteriores no aplican las restricciones `CHECK` de la Fase 5
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

Esto crea todas las tablas en `hestia_db`. Si ya tenías la base creada y se agregó un módulo
nuevo (por ejemplo `configuracion_hotel`), vuelve a correr el mismo comando: solo crea las
tablas que faltan y no toca las existentes.

> **Base de datos que ya tenías:** `create_all` no agrega columnas a tablas existentes. Si
> actualizas desde una versión anterior a la Fase 1 (código, canal y notas en `reservas`),
> ejecuta una sola vez `migraciones/2026-10_fase1_reservas.sql`:
> `mysql -u <usuario> -p hestia_db < migraciones/2026-10_fase1_reservas.sql`.
> Para la Fase 3 (reserva en línea) agrega además `configuracion_hotel.reservas_web_activas`:
> `python migraciones/fase3_reservas_web.py` (o `migraciones/2026-10_fase3_reservas_web.sql`).
> Para la Fase 4 (pagos en línea) agrega columnas en `pagos` y `configuracion_hotel`:
> `python migraciones/fase4_pagos.py` (o `migraciones/2026-10_fase4_pagos.sql`).
> Para la Fase 5 (integridad en la base, temporada/preferencias, anulación de pagos) **haz antes una copia de la base** y ejecuta
> `python migraciones/fase5_integridad.py` (no hay versión `.sql`: hay que revisar los datos existentes). Crea la tabla
> `reserva_noches` (la que impide que dos reservas ocupen la misma habitación la misma noche), agrega las columnas nuevas y las
> restricciones `CHECK`. Si ya había reservas solapadas o filas con estados inválidos, no las toca: las lista y termina con
> código 1; se corrigen a mano y se vuelve a ejecutar.
> Los scripts `.py` son idempotentes: se pueden ejecutar más de una vez.

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

## Pagos en línea con Wompi (anticipo de las reservas web)

Hestia cobra un **anticipo** (un porcentaje del total, configurable) cuando el huésped reserva en `/reservar`,
usando el *Web Checkout* de [Wompi](https://docs.wompi.co): el huésped paga en el sitio de Wompi (tarjeta, PSE,
Nequi…) y **Hestia nunca ve ni guarda datos de tarjeta**. Al aprobarse el pago, la reserva pasa sola a
`confirmada`. Sin llaves de Wompi o con anticipo `0`, todo funciona como antes (el hotel confirma a mano).
Solo cobra en **COP** (limitación de Wompi).

### Paso a paso (ambiente de pruebas)

1. **Crea una cuenta** en <https://comercios.wompi.co> y entra al panel. Para pruebas no necesitas cobrar dinero real.
2. **Copia tus llaves de pruebas.** En el panel: *Desarrolladores → Secretos para integración técnica*. Necesitas tres:
   la **llave pública** (empieza por `pub_test_`), el **secreto de integridad** y el **secreto de eventos**.
3. **Pégalas en el `.env` del backend** (ver `.env.example`) y reinicia el servidor:
   ```
   WOMPI_PUBLIC_KEY=pub_test_xxxxxxxx
   WOMPI_INTEGRITY_SECRET=test_integrity_xxxxxxxx
   WOMPI_EVENTS_SECRET=test_events_xxxxxxxx
   FRONTEND_URL=http://localhost:5173
   ```
   `FRONTEND_URL` es la dirección a la que Wompi devuelve al huésped después de pagar.
   Los secretos solo viven en el servidor: nunca van en el frontend ni en el repositorio.
4. **Aplica la migración** (una vez, si tu base ya existía): `python migraciones/fase4_pagos.py`.
5. **Activa el cobro:** entra como administrador a *Configuración → Reservas* y fija **Anticipo en línea (%)**
   (por ejemplo 30). Verás un aviso si el servidor no tiene las llaves. Deja activas también las *Reservas en línea*.
6. **Pruébalo:** reserva en `/reservar` y pulsa *Pagar anticipo con Wompi*. En el checkout de pruebas usa
   (según la [documentación de Wompi](https://docs.wompi.co/en/docs/colombia/datos-de-prueba-en-sandbox/)):
   tarjeta `4242 4242 4242 4242` = aprobada, `4111 1111 1111 1111` = rechazada (cualquier fecha futura y CVC de 3
   dígitos); Nequi `3991111111` = aprobado, `3992222222` = rechazado; PSE: «Banco que aprueba» / «Banco que rechaza».
7. **(Opcional) Webhook.** Wompi puede avisar el resultado a `https://TU-DOMINIO/api/v1/publico/wompi/eventos`
   (configúralo en el panel de Wompi, sección de eventos/URL de eventos). **No es indispensable para probar en
   tu computador:** cuando el huésped vuelve de Wompi, Hestia consulta la transacción directamente y confirma el
   pago. El webhook sí conviene en producción (cubre al huésped que cierra la pestaña antes de volver). Necesita una
   URL pública; en local solo funcionaría con un túnel (por ejemplo ngrok). Sandbox y producción tienen URLs de
   eventos separadas.

### Paso a producción

Completa la verificación de tu empresa en Wompi, cambia las tres llaves por las de producción (`pub_prod_…`),
pon en `FRONTEND_URL` el dominio real con `https`, registra la URL de eventos de producción y haz un pago real
pequeño de prueba. Hestia elige solo el ambiente (sandbox o producción) según el prefijo de la llave pública.

### Cómo funciona y qué cuidar

- Cada intento de pago crea un `Pago` en estado `pendiente` con una referencia única (`HST-XXXXXX-AB12CD`);
  el enlace de pago se firma en el servidor (SHA-256 con el secreto de integridad) y vence en 60 minutos.
  Un intento nuevo anula el anterior; máximo 10 intentos por reserva.
- El resultado solo se acepta si el aviso trae un **checksum válido** (o si Hestia lo consultó directamente a Wompi) y
  el **monto coincide** con el del pago: cualquier otra cosa se ignora. Es idempotente (un aviso repetido no duplica nada).
- Estados del pago: `pendiente` (en curso), `pagado`, `rechazado`, `anulado` (incluye devoluciones hechas desde Wompi).
  Solo los `pagado` cuentan en el saldo de la reserva.
- Una reserva con un pago en curso de menos de 2 horas no vence aunque se pase el plazo. Si el huésped paga cuando la
  reserva ya había vencido, se reactiva sola si su habitación sigue libre; si no, o si la había cancelado él mismo,
  queda cancelada y en sus **notas** aparece «⚠ … reembolsar al huésped»: **los reembolsos se hacen desde el panel de
  Wompi** (Hestia no los ejecuta).
- Una reserva con un pago aprobado no se cancela desde la web: el huésped debe comunicarse con el hotel.

## Página principal pública y rutas del frontend

- `/` es la **página principal del hotel para sus huéspedes**: muestra las habitaciones (precio desde, capacidad, camas, m²), los
  servicios, los horarios, cómo se confirma una reserva y los datos de contacto. Con las reservas en línea activas tiene un buscador
  (llegada, salida, personas) que lista los tipos con cupo y su precio total; «Reservar» lleva a `/reservar` con las fechas y la
  habitación ya elegidas. Con las reservas apagadas muestra los datos de contacto en lugar del buscador. Todo sale de la
  Configuración del hotel y del catálogo: el nombre, la ciudad, el teléfono y los precios se cambian desde el panel, no en el código.
- `/reservar` (formulario de reserva y pago del anticipo; con `?vista=consultar` abre «Consultar mi reserva»), `/pre-checkin/<token>`,
  `/login` y el panel (`/dashboard`, ...). La landing que presenta la plataforma Hestia pasó a `/hestia`.
- **Para que `/reservar` funcione hay que activar «Permitir reservas en línea»** en Configuración (viene apagado) y tener al menos
  una habitación creada por recepción. Para cobrar el anticipo, ver «Pagos en línea con Wompi».
- **Quién crea qué:** recepción crea, edita y elimina habitaciones y el catálogo de servicios; administrador y gerente solo los
  consultan. Los tipos de habitación (nombre, capacidad y precio base) los gestionan administrador y gerente.

## Fase 5: integridad, datos para ML y permisos en la interfaz

- **Capas (RNF-04):** las rutas (`app/api/routes`) solo reciben la petición HTTP y limitan peticiones; toda la lógica vive en
  `app/services/` y falla con excepciones de negocio (`app/core/errores.py`: 400, 401, 403, 404, 409, 410, 429, 502, 503)
  que `main.py` convierte en la respuesta HTTP.
- **Integridad (RNF-10):** restricciones `CHECK` sobre estados, canal, temporada, fechas, cantidades y montos, y la tabla
  `reserva_noches` (`UNIQUE habitacion_id + fecha`) que la aplica una escucha de SQLAlchemy al guardar: aunque dos
  recepcionistas reserven a la vez, la base rechaza la segunda con `409`.
- **CRUD (RF-16):** `DELETE /usuarios/{id}` y `DELETE /roles/{id}`. Un usuario que ya registró reservas o validó pre-check-ins
  no se elimina: se desactiva. Los roles base (`administrador`, `gerente`, `recepcionista`) y los roles con usuarios
  no se eliminan. Los pagos **nunca se borran**: `PUT /reservas/{id}/pagos/{pago_id}` corrige monto o método y
  `POST .../anular` los anula con un motivo obligatorio (administrador o gerente; el pago anulado deja de sumar). Los pagos de
  Wompi no se corrigen ni anulan desde aquí (los reintegros se hacen en el panel de Wompi). Los consumos se corrigen
  (`PUT .../servicios/{id}`, solo cantidad; conserva el precio congelado) o se quitan, sin dejar lo pagado por encima del total.
- **Datos para ML (RF-20):** cada reserva guarda su `temporada` (por fecha de llegada: Semana Santa, 15-dic a 15-ene y
  15-jun a 15-jul = alta; 16-jul a 31-ago y 1 a 15-oct = media; resto = baja; la regla es ajustable en
  `app/services/temporada.py`) y las `preferencias` del huésped (piso, vista, cama,
  habitación tranquila, accesible), que se capturan en el formulario de recepción y en `/reservar`.
  `GET /api/v1/reportes/dataset-reservas?formato=csv|json&desde=&hasta=&solo_cerradas=` (administrador y gerente; pantalla
  **Reportes**) exporta una fila por reserva, sin nombres, documentos, correos ni teléfonos. `anticipacion_dias` usa el reloj
  de la base de datos.
- **Permisos en la interfaz (RNF-03):** el menú, los botones y las rutas del frontend se calculan con la misma matriz que
  aplica el backend (`GET /roles/permisos`): lo que el rol no puede hacer no se muestra, y entrar por URL a una pantalla
  restringida muestra «Acceso restringido». El backend sigue siendo quien decide.

## Cuentas de huésped (Fase 6)

Quien quiere reservar en línea crea una **cuenta de huésped**. Ver la página principal, las habitaciones y la
disponibilidad sigue siendo público; **reservar exige haber iniciado sesión**.

- **Un solo formulario de acceso** (`/login`). Si el correo es de un usuario del personal entra al panel; si es de un
  huésped, vuelve a donde estaba (por ejemplo a `/reservar` con su búsqueda) o a la página principal. «Crear cuenta»
  está en esa misma pantalla (`/login?modo=registro`), en la página principal y en `/reservar`.
- **Cuentas aparte del personal** (tabla `cuentas_huesped`). El token del huésped lleva `tipo: "cliente"` y el backend
  lo rechaza en todas las rutas del panel; el del personal no sirve en las rutas de huésped. Un mismo correo no puede
  ser de las dos cosas.
- **Reserva y registro en un solo paso.** El formulario de `/reservar` pide también lo que antes se pedía en el
  pre-check-in (nacionalidad, fecha de nacimiento, procedencia, acompañantes, hora de llegada y motivo del viaje). La
  reserva nace con su registro en estado `completado`; recepción lo valida desde el detalle de la reserva, como siempre.
  El enlace `/pre-checkin/<token>` sigue existiendo para las reservas tomadas por teléfono u otro canal.
- **Mis reservas** (`/mis-reservas`): lista las reservas hechas con la cuenta; desde ahí se paga el anticipo y se
  cancela. Las reservas que ya existían (teléfono, anteriores) siguen consultándose con código + documento.
- **Límites:** 10 contraseñas incorrectas por IP en 5 minutos (después, `429`); 10 cuentas nuevas por IP por hora;
  hasta 3 reservas pendientes por cuenta.
- **Migración:** `python migraciones/fase6_cuentas.py` (crea `cuentas_huesped` y `reservas.cuenta_id`). Haz copia de la
  base antes. Es repetible.

## Estructura del proyecto

```
hestia/
├── app/
│   ├── core/
│   │   ├── config.py            # Variables de entorno (pydantic-settings)
│   │   ├── limites.py           # Límite de peticiones por IP en las rutas públicas
│   │   ├── errores.py           # Excepciones de negocio (ErrorNegocio y subclases)
│   │   ├── permisos.py          # Matriz de permisos calculada desde las rutas
│   │   ├── security.py          # Hash de contraseñas (bcrypt) y tokens JWT
│   │   └── vencimiento.py       # Cancelación automática de reservas pendientes vencidas
│   ├── db/
│   │   ├── base_class.py        # Base declarativa de SQLAlchemy
│   │   ├── base.py              # Registro de todos los modelos (para Alembic)
│   │   └── session.py           # Engine, SessionLocal y dependencia get_db
│   ├── models/                  # Tablas SQLAlchemy
│   │   ├── role.py, usuario.py, configuracion.py
│   │   ├── tipo_habitacion.py, habitacion.py
│   │   ├── huesped.py, reserva.py, precheckin.py
│   │   └── servicio.py, reserva_servicio.py, pago.py, reserva_noche.py
│   ├── services/                # Lógica de negocio (reservas, pagos, ocupación, reportes...)
│   ├── schemas/                 # Esquemas Pydantic (entrada/salida de la API)
│   │   └── role, usuario, tipo_habitacion, habitacion, huesped, reserva,
│   │       servicio, reserva_servicio, pago, factura
│   ├── api/
│   │   ├── deps.py              # get_db, get_current_user, require_roles (RBAC)
│   │   └── routes/
│   │       ├── health.py, auth.py, roles.py, usuarios.py
│   │       ├── tipos_habitacion.py, habitaciones.py, disponibilidad.py
│   │       ├── huespedes.py, reservas.py, precheckin.py
│   │       └── servicios.py, reserva_servicios.py, pagos.py, facturas.py, reportes.py
│   └── main.py                  # Instancia de FastAPI y registro de routers
├── frontend/                    # React + Vite
├── migraciones/                 # Scripts SQL para bases ya creadas (ALTER TABLE)
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
| Autenticación | `POST /auth/login`, `GET /auth/me`, `PUT /auth/me/password`, `POST /auth/register` | `register`: administrador. `me/password`: cada usuario cambia la suya (pide la actual) |
| Roles | `GET/POST /roles/`, `PUT/DELETE /roles/{id}` (editar: solo la descripción), `GET /roles/permisos` | crear, editar y eliminar: administrador. `permisos` devuelve la matriz módulo × acción × rol y los usuarios por rol |
| Configuración | `GET/PUT /configuracion/` | consultar: cualquier usuario; modificar: administrador |
| Usuarios | `GET /usuarios/`, `GET/PUT/DELETE /usuarios/{id}`, `PUT /usuarios/{id}/password` | solo administrador; eliminar solo si nunca registró actividad (el alta es `POST /auth/register`) |
| Tipos de habitación | `GET/POST /tipos-habitacion/`, `GET/PUT/DELETE /tipos-habitacion/{id}` | administrador, gerente |
| Habitaciones | `GET/POST /habitaciones/`, `GET/PUT/DELETE /habitaciones/{id}` | consultar: cualquier usuario. Crear, editar y eliminar: **solo recepcionista** (administrador y gerente solo miran) |
| Disponibilidad | `GET /disponibilidad/?fecha_checkin=&fecha_checkout=` | — |
| Huéspedes | `GET/POST /huespedes/`, `GET/PUT/DELETE /huespedes/{id}` | cualquier usuario; eliminar: administrador, gerente |
| Reservas | `GET/POST /reservas/` (filtros `huesped_id`, `habitacion_id`, `estado`, `codigo`), `GET/PUT/DELETE /reservas/{id}`, `POST /reservas/{id}/confirmar`, `/checkin`, `/checkout`, `/cancelar`, `/no-show` | cualquier usuario; eliminar: administrador |
| Pre-check-in | `GET/POST /reservas/{id}/precheckin/` (crear o regenerar el enlace), `POST /reservas/{id}/precheckin/validar` | cualquier usuario |
| Pre-check-in (público) | `GET/PUT /publico/precheckin/{token}` | sin sesión: lo usa el huésped con su enlace |
| Reserva en línea (público) | `GET /publico/hotel`, `GET /publico/disponibilidad`, `POST /publico/reservas`, `POST /publico/reservas/consultar`, `POST /publico/reservas/cancelar`, `POST /publico/reservas/pagar`, `POST /publico/reservas/verificar-pago` | sin sesión, **excepto `POST /publico/reservas`, que exige iniciar sesión con una cuenta de huésped** (`401` si no); las de disponibilidad y creación responden `403` si el hotel no activó `reservas_web_activas` |
| Cuenta del huésped | `POST /cuenta/registro`, `GET /cuenta/me`, `GET /cuenta/reservas`, `POST /cuenta/reservas/{codigo}/cancelar`, `/pagar`, `/verificar-pago` | registro sin sesión; el resto, solo con sesión de huésped (el personal no entra por aquí). Una cuenta solo ve y gestiona sus propias reservas |
| Catálogo público | `GET /publico/catalogo` | sin sesión; tipos de habitación (nombre, descripción, capacidad, camas, m², precio por noche) y servicios. Nunca números de habitación. Funciona aunque las reservas en línea estén apagadas |
| Webhook de Wompi (público) | `POST /publico/wompi/eventos` | sin sesión; solo acepta avisos con checksum válido |
| Servicios (catálogo) | `GET/POST /servicios/`, `GET/PUT/DELETE /servicios/{id}` | consultar: cualquier usuario. Crear, editar y eliminar: **solo recepcionista** |
| Consumo de servicios | `GET/POST /reservas/{id}/servicios/`, `PUT/DELETE /reservas/{id}/servicios/{consumo_id}` | cualquier usuario |
| Pagos | `GET/POST /reservas/{id}/pagos/`, `PUT /reservas/{id}/pagos/{pago_id}`, `POST .../{pago_id}/anular` | registrar: cualquier usuario; corregir y anular: administrador, gerente |
| Reportes | `GET /reportes/dataset-reservas` | administrador, gerente |
| Facturación | `GET /reservas/{id}/resumen` | — |

## Reglas de negocio

- **Estados de una reserva:** `pendiente → confirmada → checkin → checkout`.
  Solo se puede cancelar desde `pendiente` o `confirmada`. Si el huésped no llega,
  una reserva `pendiente` o `confirmada` cuya fecha de llegada ya es hoy o pasó se marca
  `no_show` (`POST /reservas/{id}/no-show`): libera la habitación y conserva los pagos.
- **Código y canal:** cada reserva recibe un código legible (`HST-K7M4QX`) para citarlo
  por teléfono y un canal de origen (`presencial`, `telefono`, `whatsapp`, `correo`, `web`,
  `otro`), más notas libres (máx. 500 caracteres).
- **Editar una reserva (`PUT /reservas/{id}`):** pendiente o confirmada → habitación, fechas,
  huéspedes, canal y notas (se vuelve a validar disponibilidad y capacidad y se recalcula el
  precio; no puede quedar por debajo de lo ya pagado). En `checkin` solo la salida prevista,
  los huéspedes y las notas. En cualquier otro estado, solo las notas. El huésped no cambia.
- **Pre-check-in:** recepción crea un enlace único (`/pre-checkin/<token>`) para una reserva pendiente
  o confirmada cuya llegada no ha pasado; el huésped completa sin iniciar sesión sus datos, los de sus
  acompañantes (hasta `num_huespedes − 1`), la hora de llegada y el motivo del viaje. El estado sigue
  `enviado → completado → validado`. Mientras no esté validado el huésped puede corregir y reenviar.
  Al **validar**, recepción aplica los datos del titular al registro del huésped; si el documento
  declarado difiere del registrado hay que confirmarlo expresamente (`actualizar_documento`). Los
  acompañantes quedan guardados en el pre-check-in como respaldo del registro de alojamiento. Generar un
  enlace nuevo invalida el anterior; el enlace deja de servir si la reserva se cancela o pasa la fecha de
  llegada. Las rutas públicas limitan las peticiones por IP (40/min y 8 tokens inválidos/min → `429`) y
  no exponen precio, ids ni el documento, teléfono o correo ya registrados. La tabla `precheckins` es nueva:
  `create_all` la crea sin tocar las demás.
- **Reserva en línea (`/reservar`):** página pública, apagada por defecto; el administrador la activa en
  Configuración («Permitir reservas en línea»). El huésped elige fechas y número de personas, ve los
  *tipos* de habitación con cupo (precio por noche y total; nunca números de habitación) y deja sus datos.
  **El pago en línea es opcional** (ver «Pagos en línea con Wompi»): sin él, la reserva nace `pendiente` con canal `web` y recepción la confirma (aparece
  en la campana como «reservas en línea por confirmar»). Si nadie la confirma vence sola según
  `horas_vencimiento_pendiente` (con `0` las pendientes web **nunca** vencen: no lo uses si activas esto).
  El sistema asigna la primera habitación libre del tipo (con bloqueo de filas para no duplicar). Se
  atribuye a un usuario de sistema inactivo («Reservas en línea», `reservas-en-linea@hestia.co`), que no
  puede iniciar sesión. Si el documento ya está registrado, el huésped existente **no se modifica**
  (los datos de contacto declarados quedan en las notas de la reserva) y no se le entrega enlace de
  pre-check-in; un huésped nuevo recibe de una vez el enlace para completar su registro. Consultar o
  cancelar exige código + documento del titular (error genérico `404`; 8 fallos/min por IP → `429`);
  una reserva con pagos no se cancela en línea. Anti-abuso: 5 reservas creadas por IP cada 10 min,
  máximo 3 pendientes web por huésped, campo trampa oculto (`sitio_web`), máximo 30 noches y 365 días de
  anticipación.
- **Vencimiento de pendientes:** una reserva `pendiente` sin pagos se cancela sola
  (`motivo_cancelacion`) pasadas `horas_vencimiento_pendiente` desde su creación (24 por
  defecto; `0` desactiva el vencimiento; se cambia en Configuración). Una reserva con algún pago
  no vence. No hay tarea en segundo plano: la limpieza corre antes de atender cualquier
  consulta de reservas o de disponibilidad.
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
- **Pagos:** no se borran: se corrigen o se anulan con motivo (ver «Fase 5»); el monto debe ser mayor que 0 (máximo 10 dígitos y 2 decimales), no
  puede superar el saldo pendiente y no se aceptan pagos de una reserva cancelada.
- **Configuración:** datos del hotel, horarios de check-in/out, moneda y zona horaria en una sola fila (`configuracion_hotel`). Mientras no se guarde nada, `GET /configuracion/` devuelve valores por defecto. El nombre del hotel se muestra en el menú y la moneda en todos los montos del panel; las horas y la zona horaria son de referencia.
- **Roles y permisos:** los permisos se asignan por nombre de rol con `require_roles` en cada ruta. `GET /roles/permisos` los calcula recorriendo las rutas reales, así que la pantalla de Roles siempre refleja lo que la API aplica (es de solo lectura). Un rol nuevo solo accede a las rutas abiertas a cualquier usuario autenticado. El nombre de un rol no se puede cambiar.
- **Usuarios:** se desactivan (`activo: false`) o, si nunca registraron actividad, se eliminan; un usuario inactivo no puede iniciar sesión y su token deja de funcionar de inmediato. Un administrador no puede desactivarse ni cambiarse el rol a sí mismo, y siempre debe quedar al menos un administrador activo.
- **Borrados:** no se eliminan tipos de habitación, habitaciones, huéspedes,
  servicios ni reservas que tengan registros asociados.