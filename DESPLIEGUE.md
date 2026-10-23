# Despliegue gratuito de Hestia (Render + Aiven)

Todo el sistema corre en **un solo servicio web** (la API sirve también el sitio ya compilado, así
no hace falta CORS) y la base de datos MySQL va aparte, en Aiven.

| Pieza | Servicio | Costo | Tarjeta |
|---|---|---|---|
| API + sitio React | [Render](https://render.com) (Web Service, Docker) | gratis | no |
| MySQL 8 | [Aiven](https://aiven.io/free-mysql-database) (plan Free) | gratis, sin límite de tiempo | no |

## Qué esperar del plan gratis (importante para la demo)

- **Render se duerme a los 15 min sin visitas** y tarda ~1 minuto en despertar. Abre la página un minuto antes de presentar.
- Render da 750 horas/mes (alcanza para un servicio las 24 h). El disco es efímero: no guardes archivos en él (Hestia no lo hace).
- **Aiven Free**: 1 GB de disco, 1 GB de RAM, máx. 76 conexiones. Si no hay actividad, **apaga el servicio** (avisa por correo) y lo enciendes desde su consola. Sin IP fija.
- Los límites por IP (login, reservas) están en memoria: se reinician cuando Render duerme/reinicia el servicio. Aceptable para demo; no para producción real.
- Estos planes no son para un hotel en producción real. Para eso: Render de pago (~7 USD/mes) y MySQL con respaldos diarios.

## 1. Subir el código a GitHub

Copia estos archivos a tu proyecto (raíz del repo) y haz tú el commit y push:
`Dockerfile`, `.dockerignore`, `render.yaml`, `deploy/`, `DESPLIEGUE.md`, y los cambios de
`app/core/config.py`, `app/db/session.py`, `app/main.py`, `.env.example`, `.gitignore`.

## 2. Crear la base de datos en Aiven

1. Regístrate en aiven.io (con GitHub o Google, sin tarjeta) → **Create service → MySQL → plan Free**.
2. Cuando esté en *Running*, en la pestaña **Overview** copia: **Host**, **Port**, **User** (`avnadmin`), **Password**, **Database name** (`defaultdb`).
3. Descarga el **CA certificate** (`ca.pem`) y ábrelo con un editor de texto: lo vas a pegar completo en Render.

## 3. Crear el servicio en Render

1. En Render: **New → Blueprint**, conecta tu repositorio de GitHub; detecta `render.yaml`.
2. Rellena las variables que pide:

| Variable | Valor |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` | los de Aiven |
| `DB_NAME` | `defaultdb` (o la que creaste) |
| `DB_SSL_CA_PEM` | el contenido completo de `ca.pem` (pégalo tal cual, con sus saltos de línea) |
| `ADMIN_NOMBRE`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | tu usuario administrador inicial (contraseña de 8+ caracteres) |
| `FRONTEND_URL` | la URL que te dé Render, p. ej. `https://hestia.onrender.com` (si aún no la sabes, déjala y corrígela después del primer despliegue) |
| `WOMPI_*` | vacías por ahora (sin pagos en línea) |

`SECRET_KEY` la genera Render sola. Pulsa **Apply**: construye la imagen (varios minutos la primera vez).

Al arrancar, el contenedor crea las tablas y los roles, y crea el administrador si aún no existe
(ver `deploy/inicializar.py`). Lo puedes ver en los *Logs* de Render.

## 4. Probar

1. Abre la URL de Render → debe verse la página de Hestia.
2. Entra con `/login` usando el administrador que definiste.
3. Configuración → marca **Permitir reservas en línea** y guarda (así `/reservar` queda activo).
4. Crea un tipo de habitación y habitaciones, y prueba una reserva con una cuenta de huésped.

## 5. Pagos con Wompi (cuando tengas las llaves de pruebas)

En Render → Environment: `WOMPI_PUBLIC_KEY` (`pub_test_…`), `WOMPI_INTEGRITY_SECRET`, `WOMPI_EVENTS_SECRET`
y `FRONTEND_URL` con tu URL real. En el panel de Wompi configura la URL de eventos:
`https://TU-SERVICIO.onrender.com/api/v1/publico/wompi/eventos`.

## 6. Seguir trabajando después

- **Cada `git push` a la rama conectada redespliega** automáticamente. Desarrolla en local como hasta ahora.
- Tablas nuevas: `inicializar.py` las crea solo. **Columnas nuevas en tablas existentes** (como ocurrió en las fases 1–6) no las agrega `create_all`: crea un script en `migraciones/` y ejecútalo contra la base de Aiven desde tu computador, poniendo en tu `.env` local el host/usuario/contraseña de Aiven, `DB_SSL=true` y `DB_SSL_CA` con la ruta a tu `ca.pem`:
  `python migraciones/mi_migracion.py`
  Hazlo **antes** de desplegar el código que usa esas columnas. En Aiven, haz respaldo antes (consola → Backups).
- Para trabajar local contra tu MySQL local no cambies nada: `DB_SSL=false` es el valor por defecto.
- Si Aiven apaga el servicio por inactividad, vuelve a encenderlo desde su consola; la API se reconecta sola.
