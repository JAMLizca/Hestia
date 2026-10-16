import { useState } from "react";
import { habitacionesApi } from "../../api/services";
import { Button, ErrorBanner, InfoBanner } from "../../components/ui";
import { cleanPayload, Field, Input, Select, Textarea } from "../../components/ui/Form";
import { Modal } from "../../components/ui/Modal";
import { formatMoney } from "../../utils/format";
import { HABITACION_ESTADOS } from "../../utils/status";

const ESTADO_OPTIONS = Object.entries(HABITACION_ESTADOS).map(([value, s]) => ({ value, label: s.label }));

/**
 * Crear (POST /habitaciones/, admin/gerente) o editar (PUT /habitaciones/{id}).
 * El backend no permite cambiar el número al editar (HabitacionUpdate no lo incluye).
 */
export default function HabitacionFormModal({ habitacion, tipos, onClose, onSaved }) {
  const editing = Boolean(habitacion);
  const [values, setValues] = useState({
    numero: habitacion?.numero ?? "",
    tipo_habitacion_id: habitacion ? String(habitacion.tipo_habitacion_id) : "",
    piso: habitacion?.piso ?? "",
    estado: habitacion?.estado ?? "disponible",
    caracteristicas: habitacion?.caracteristicas ?? "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload = cleanPayload(values, { numbers: ["tipo_habitacion_id", "piso"] });
      let saved;
      if (editing) {
        delete payload.numero;
        saved = await habitacionesApi.update(habitacion.id, payload);
      } else {
        saved = await habitacionesApi.create(payload);
      }
      onSaved(saved);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal
      title={editing ? `Editar habitación ${habitacion.numero}` : "Nueva habitación"}
      width={560}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="habitacion-form" loading={saving} disabled={!tipos.length}>
            {editing ? "Guardar cambios" : "Crear habitación"}
          </Button>
        </>
      }
    >
      {!tipos.length && (
        <div style={{ marginBottom: 16 }}>
          <InfoBanner>Primero crea un tipo de habitación en la pestaña “Tipos de habitación”.</InfoBanner>
        </div>
      )}
      <form id="habitacion-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <Field label="Número" required hint={editing ? "El número no se puede modificar." : undefined}>
            <Input value={values.numero} onChange={set("numero")} required disabled={editing} autoFocus={!editing} />
          </Field>
          <Field label="Piso">
            <Input type="number" value={values.piso} onChange={set("piso")} />
          </Field>
          <Field label="Tipo de habitación" required>
            <Select
              required
              placeholder="Selecciona un tipo"
              value={values.tipo_habitacion_id}
              onChange={set("tipo_habitacion_id")}
              options={tipos.map((t) => ({ value: String(t.id), label: `${t.nombre} — ${formatMoney(t.precio_base)} / noche` }))}
            />
          </Field>
          <Field label="Estado" required>
            <Select options={ESTADO_OPTIONS} value={values.estado} onChange={set("estado")} />
          </Field>
          <Field label="Características" full>
            <Textarea value={values.caracteristicas} onChange={set("caracteristicas")} placeholder="Ej.: balcón, vista a la ciudad" />
          </Field>
        </div>
        {error && (
          <div style={{ marginTop: 16 }}>
            <ErrorBanner message={error} />
          </div>
        )}
      </form>
    </Modal>
  );
}
