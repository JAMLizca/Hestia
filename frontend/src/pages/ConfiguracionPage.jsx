import { Copy, Save, Undo2 } from "lucide-react";
import { useState } from "react";
import { configApi } from "../api/services";
import { Button, Card, ErrorBanner, InfoBanner, LoadingState } from "../components/ui";
import { Field, Input, Select } from "../components/ui/Form";
import { usePermisos } from "../context/PermisosContext";
import { useConfig } from "../context/ConfigContext";
import { useToast } from "../context/ToastContext";
import { useApiData } from "../hooks/useApiData";

// Opciones admitidas por el backend (schemas/configuracion.py).
const MONEDAS = [
  { value: "COP", label: "COP — Peso colombiano" },
  { value: "USD", label: "USD — Dólar estadounidense" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "MXN", label: "MXN — Peso mexicano" },
  { value: "PEN", label: "PEN — Sol peruano" },
  { value: "CLP", label: "CLP — Peso chileno" },
  { value: "ARS", label: "ARS — Peso argentino" },
  { value: "BRL", label: "BRL — Real brasileño" },
];

const ZONAS = [
  { value: "America/Bogota", label: "Bogotá (UTC−5)" },
  { value: "America/Lima", label: "Lima (UTC−5)" },
  { value: "America/Mexico_City", label: "Ciudad de México" },
  { value: "America/Santiago", label: "Santiago de Chile" },
  { value: "America/Argentina/Buenos_Aires", label: "Buenos Aires" },
  { value: "America/Sao_Paulo", label: "São Paulo" },
  { value: "America/New_York", label: "Nueva York" },
  { value: "America/Los_Angeles", label: "Los Ángeles" },
  { value: "Europe/Madrid", label: "Madrid" },
  { value: "UTC", label: "UTC" },
];

const TEXT_FIELDS = ["nombre", "razon_social", "nit", "direccion", "ciudad", "pais", "telefono", "email", "sitio_web"];

/** De la respuesta de la API a valores de formulario (texto; la hora como HH:MM). */
function toForm(config) {
  const values = Object.fromEntries(TEXT_FIELDS.map((k) => [k, config[k] ?? ""]));
  return {
    ...values,
    hora_checkin: (config.hora_checkin ?? "").slice(0, 5),
    hora_checkout: (config.hora_checkout ?? "").slice(0, 5),
    horas_vencimiento_pendiente: String(config.horas_vencimiento_pendiente ?? 24),
    reservas_web_activas: Boolean(config.reservas_web_activas),
    anticipo_porcentaje: String(config.anticipo_porcentaje ?? 0),
    moneda: config.moneda,
    zona_horaria: config.zona_horaria,
  };
}

/** Del formulario al cuerpo del PUT: los textos vacíos se envían como null. */
function toPayload(values) {
  const payload = { ...values };
  TEXT_FIELDS.forEach((k) => {
    payload[k] = values[k].trim() || null;
  });
  payload.horas_vencimiento_pendiente = Number(values.horas_vencimiento_pendiente);
  payload.anticipo_porcentaje = Number(values.anticipo_porcentaje);
  return payload;
}

function formatUpdated(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("es-CO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * Configuración general: datos del hotel, horarios y ajustes regionales. Todos los usuarios
 * pueden consultarla; solo el administrador puede guardar cambios.
 */
export default function ConfiguracionPage() {
  const { data, loading, error, reload } = useApiData({ config: () => configApi.get() });
  return (
    <>
      <ErrorBanner message={error} onRetry={reload} />
      {loading && !error && <LoadingState />}
      {data.config && <ConfigForm initial={data.config} />}
    </>
  );
}

function ConfigForm({ initial }) {
  const { can } = usePermisos();
  const { update } = useConfig();
  const toast = useToast();
  const esAdmin = can("configuracion", "editar");

  const [baseline, setBaseline] = useState(() => toForm(initial));
  const [values, setValues] = useState(() => toForm(initial));
  const [updatedAt, setUpdatedAt] = useState(initial.fecha_actualizacion);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const dirty = JSON.stringify(values) !== JSON.stringify(baseline);
  // VITE_PUBLIC_URL: dominio público del panel; sin él se usa el de la pestaña (en desarrollo, localhost).
  const urlReservas = `${(import.meta.env.VITE_PUBLIC_URL || window.location.origin).replace(/\/$/, "")}/reservar`;
  async function copiarUrl() {
    try {
      await navigator.clipboard.writeText(urlReservas);
      toast.success("Enlace copiado");
    } catch {
      toast.error("No se pudo copiar; selecciónalo y cópialo a mano");
    }
  }
  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));
  const readOnly = !esAdmin;

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const saved = await configApi.update(toPayload(values));
      const form = toForm(saved);
      setBaseline(form);
      setValues(form);
      setUpdatedAt(saved.fecha_actualizacion);
      update(saved); // el menú lateral y los montos usan la configuración nueva
      toast.success("Configuración guardada");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const actualizado = formatUpdated(updatedAt);

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {readOnly && <InfoBanner>Solo un administrador puede modificar la configuración. Aquí la puedes consultar.</InfoBanner>}

      <Card title="Información del hotel" subtitle="Datos del establecimiento. El nombre se muestra en el menú lateral.">
        <div className="form-grid">
          <Field label="Nombre del hotel" required full>
            <Input value={values.nombre} onChange={set("nombre")} maxLength={150} required disabled={readOnly} />
          </Field>
          <Field label="Razón social">
            <Input value={values.razon_social} onChange={set("razon_social")} maxLength={150} disabled={readOnly} />
          </Field>
          <Field label="NIT">
            <Input value={values.nit} onChange={set("nit")} maxLength={30} placeholder="900.123.456-7" disabled={readOnly} />
          </Field>
          <Field label="Dirección" full>
            <Input value={values.direccion} onChange={set("direccion")} maxLength={200} disabled={readOnly} />
          </Field>
          <Field label="Ciudad">
            <Input value={values.ciudad} onChange={set("ciudad")} maxLength={100} disabled={readOnly} />
          </Field>
          <Field label="País">
            <Input value={values.pais} onChange={set("pais")} maxLength={100} disabled={readOnly} />
          </Field>
          <Field label="Teléfono">
            <Input type="tel" value={values.telefono} onChange={set("telefono")} maxLength={30} disabled={readOnly} />
          </Field>
          <Field label="Correo de contacto">
            <Input type="email" value={values.email} onChange={set("email")} maxLength={150} placeholder="reservas@hotel.com" disabled={readOnly} />
          </Field>
          <Field label="Sitio web" full>
            <Input value={values.sitio_web} onChange={set("sitio_web")} maxLength={200} placeholder="https://www.hotel.com" disabled={readOnly} />
          </Field>
        </div>
      </Card>

      <Card title="Horarios" subtitle="Horario estándar de ingreso y salida del hotel. Es una referencia: el sistema no bloquea check-in ni check-out por hora.">
        <div className="form-grid">
          <Field label="Hora de check-in" required>
            <Input type="time" value={values.hora_checkin} onChange={set("hora_checkin")} required disabled={readOnly} />
          </Field>
          <Field label="Hora de check-out" required>
            <Input type="time" value={values.hora_checkout} onChange={set("hora_checkout")} required disabled={readOnly} />
          </Field>
        </div>
      </Card>

      <Card title="Reservas" subtitle="Una reserva tomada por teléfono u otro canal que nadie confirma dejaría la habitación bloqueada.">
        <div className="form-grid">
          <div className="field field--full">
            <span className="field__label">Reservas en línea</span>
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={values.reservas_web_activas}
                onChange={(e) => setValues((v) => ({ ...v, reservas_web_activas: e.target.checked }))}
                disabled={readOnly}
                style={{ width: 18, height: 18, accentColor: "var(--navy-700)" }}
              />
              Permitir reservas en línea
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
              <Input value={urlReservas} readOnly aria-label="Enlace de la página de reservas" />
              <Button type="button" variant="outline" icon={Copy} onClick={copiarUrl}>
                Copiar
              </Button>
            </div>
            <span className="field__hint">
              Los huéspedes reservan en la página pública. Si cobras anticipo en línea, la reserva se confirma sola al pagar; si no, queda pendiente y tú la confirmas. Si nadie la confirma a tiempo, vence sola. Recuerda pulsar «Guardar cambios».
            </span>
          </div>
          <Field
            label="Anticipo en línea (% del total)"
            required
            hint={
              initial.pasarela_configurada
                ? "Se cobra con Wompi al reservar en línea; la reserva se confirma sola al pagar. Usa 0 para no cobrar en línea."
                : "Wompi aún no está configurado en el servidor (ver README, «Pagos en línea»). Mientras tanto no se cobra en línea."
            }
          >
            <Input type="number" min={0} max={100} step={1} value={values.anticipo_porcentaje} onChange={set("anticipo_porcentaje")} required disabled={readOnly} />
          </Field>
          <Field
            label="Horas para que venza una reserva pendiente"
            required
            hint="Pasado ese plazo, la reserva pendiente se cancela sola y la habitación queda libre. No aplica si ya tiene un pago. Usa 0 para que nunca venzan."
          >
            <Input
              type="number"
              min={0}
              max={720}
              step={1}
              value={values.horas_vencimiento_pendiente}
              onChange={set("horas_vencimiento_pendiente")}
              required
              disabled={readOnly}
            />
          </Field>
        </div>
      </Card>

      <Card title="Configuración regional" subtitle="Cómo se muestran los montos y en qué zona horaria opera el hotel.">
        <div className="form-grid">
          <Field label="Moneda" required hint="Se usa para mostrar todos los montos del panel. No convierte los valores ya guardados.">
            <Select options={MONEDAS} value={values.moneda} onChange={set("moneda")} required disabled={readOnly} />
          </Field>
          <Field label="Zona horaria" required hint="Referencia del hotel. Las fechas del panel se muestran con la hora de tu navegador.">
            <Select options={ZONAS} value={values.zona_horaria} onChange={set("zona_horaria")} required disabled={readOnly} />
          </Field>
        </div>
      </Card>

      {error && <ErrorBanner message={error} />}

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <span style={{ fontSize: 12, color: "var(--gray-400)" }}>{actualizado ? `Última actualización: ${actualizado}` : "Aún no se ha guardado ninguna configuración."}</span>
        {esAdmin && (
          <div style={{ display: "flex", gap: 10 }}>
            <Button variant="outline" icon={Undo2} disabled={!dirty || saving} onClick={() => setValues(baseline)}>
              Descartar cambios
            </Button>
            <Button type="submit" icon={Save} loading={saving} disabled={!dirty}>
              Guardar cambios
            </Button>
          </div>
        )}
      </div>
    </form>
  );
}
