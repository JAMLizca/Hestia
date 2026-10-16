import { useState } from "react";
import { serviciosApi } from "../../api/services";
import { Button, ErrorBanner } from "../../components/ui";
import { cleanPayload, Field, Input, Textarea } from "../../components/ui/Form";
import { Modal } from "../../components/ui/Modal";

// Categorías que aparecen en el mockup (el backend acepta cualquier texto).
const CATEGORIAS_MOCKUP = ["Alimentos", "Lavandería", "Habitación", "Transporte", "Bienestar", "Actividades"];

/** Crear o editar un servicio del catálogo (POST/PUT /servicios/, admin/gerente). */
export default function ServicioFormModal({ servicio, onClose, onSaved }) {
  const editing = Boolean(servicio);
  const [values, setValues] = useState({
    nombre: servicio?.nombre ?? "",
    categoria: servicio?.categoria ?? "",
    precio: servicio ? Number(servicio.precio) : "",
    descripcion: servicio?.descripcion ?? "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload = cleanPayload(values, { numbers: ["precio"] });
      const saved = editing ? await serviciosApi.update(servicio.id, payload) : await serviciosApi.create(payload);
      onSaved(saved);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal
      title={editing ? `Editar “${servicio.nombre}”` : "Nuevo servicio"}
      subtitle="Catálogo de servicios adicionales del hotel"
      width={520}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="servicio-form" loading={saving}>
            {editing ? "Guardar cambios" : "Crear servicio"}
          </Button>
        </>
      }
    >
      <form id="servicio-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <Field label="Nombre" required full>
            <Input value={values.nombre} onChange={set("nombre")} required autoFocus />
          </Field>
          <Field label="Categoría">
            <Input list="categorias-servicio" value={values.categoria} onChange={set("categoria")} />
            <datalist id="categorias-servicio">
              {CATEGORIAS_MOCKUP.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label="Precio" required>
            <Input type="number" min="1" step="0.01" value={values.precio} onChange={set("precio")} required />
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
