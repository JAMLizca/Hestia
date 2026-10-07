import { useState } from "react";
import { tiposHabitacionApi } from "../../api/services";
import { Button, ErrorBanner } from "../../components/ui";
import { cleanPayload, Field, Input, Textarea } from "../../components/ui/Form";
import { Modal } from "../../components/ui/Modal";

/** Crear o editar un tipo de habitación (POST/PUT /tipos-habitacion/, admin/gerente). */
export default function TipoHabitacionFormModal({ tipo, onClose, onSaved }) {
  const editing = Boolean(tipo);
  const [values, setValues] = useState({
    nombre: tipo?.nombre ?? "",
    descripcion: tipo?.descripcion ?? "",
    capacidad_maxima: tipo?.capacidad_maxima ?? 2,
    camas: tipo?.camas ?? 1,
    precio_base: tipo ? Number(tipo.precio_base) : "",
    metros_cuadrados: tipo?.metros_cuadrados != null ? Number(tipo.metros_cuadrados) : "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload = cleanPayload(values, { numbers: ["capacidad_maxima", "camas", "precio_base", "metros_cuadrados"] });
      const saved = editing ? await tiposHabitacionApi.update(tipo.id, payload) : await tiposHabitacionApi.create(payload);
      onSaved(saved);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal
      title={editing ? `Editar tipo “${tipo.nombre}”` : "Nuevo tipo de habitación"}
      width={560}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="tipo-form" loading={saving}>
            {editing ? "Guardar cambios" : "Crear tipo"}
          </Button>
        </>
      }
    >
      <form id="tipo-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <Field label="Nombre" required>
            <Input value={values.nombre} onChange={set("nombre")} required autoFocus />
          </Field>
          <Field label="Precio base por noche" required>
            <Input type="number" min="1" step="0.01" value={values.precio_base} onChange={set("precio_base")} required />
          </Field>
          <Field label="Capacidad máxima" required>
            <Input type="number" min="1" value={values.capacidad_maxima} onChange={set("capacidad_maxima")} required />
          </Field>
          <Field label="Camas" required>
            <Input type="number" min="1" value={values.camas} onChange={set("camas")} required />
          </Field>
          <Field label="Metros cuadrados">
            <Input type="number" min="0" step="0.01" value={values.metros_cuadrados} onChange={set("metros_cuadrados")} />
          </Field>
          <Field label="Descripción" full>
            <Textarea value={values.descripcion} onChange={set("descripcion")} />
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
