import { useState } from "react";
import { huespedesApi } from "../../api/services";
import { cleanPayload, Field, Input, Select, Textarea } from "../../components/ui/Form";
import { Button, ErrorBanner } from "../../components/ui";
import { Modal } from "../../components/ui/Modal";

const TIPOS_DOCUMENTO = [
  { value: "CC", label: "CC — Cédula de ciudadanía" },
  { value: "CE", label: "CE — Cédula de extranjería" },
  { value: "TI", label: "TI — Tarjeta de identidad" },
  { value: "PA", label: "PA — Pasaporte" },
];

const EMPTY = {
  documento_identidad: "",
  tipo_documento: "CC",
  nombres: "",
  apellidos: "",
  email: "",
  telefono: "",
  nacionalidad: "",
  fecha_nacimiento: "",
  preferencias: "",
};

/**
 * Registrar (POST /huespedes/) o editar (PUT /huespedes/{id}) un huésped.
 * El backend no permite cambiar el documento de identidad al editar (HuespedUpdate).
 */
export default function HuespedFormModal({ huesped, onClose, onSaved }) {
  const editing = Boolean(huesped);
  const [values, setValues] = useState(() => (editing ? { ...EMPTY, ...nullsToEmpty(huesped) } : EMPTY));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload = cleanPayload(values);
      let saved;
      if (editing) {
        delete payload.documento_identidad;
        saved = await huespedesApi.update(huesped.id, payload);
      } else {
        saved = await huespedesApi.create(payload);
      }
      onSaved(saved);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal
      title={editing ? "Editar huésped" : "Registrar huésped"}
      subtitle={editing ? `${huesped.nombres} ${huesped.apellidos}` : "Datos personales y de contacto del huésped"}
      width={620}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="huesped-form" loading={saving}>
            {editing ? "Guardar cambios" : "Registrar huésped"}
          </Button>
        </>
      }
    >
      <form id="huesped-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <Field label="Tipo de documento" required>
            <Select options={TIPOS_DOCUMENTO} value={values.tipo_documento} onChange={set("tipo_documento")} required />
          </Field>
          <Field label="Número de documento" required hint={editing ? "El documento no se puede modificar." : undefined}>
            <Input value={values.documento_identidad} onChange={set("documento_identidad")} required disabled={editing} />
          </Field>
          <Field label="Nombres" required>
            <Input value={values.nombres} onChange={set("nombres")} required autoFocus />
          </Field>
          <Field label="Apellidos" required>
            <Input value={values.apellidos} onChange={set("apellidos")} required />
          </Field>
          <Field label="Correo electrónico">
            <Input type="email" value={values.email} onChange={set("email")} placeholder="nombre@correo.com" />
          </Field>
          <Field label="Teléfono">
            <Input type="tel" value={values.telefono} onChange={set("telefono")} />
          </Field>
          <Field label="Nacionalidad">
            <Input value={values.nacionalidad} onChange={set("nacionalidad")} />
          </Field>
          <Field label="Fecha de nacimiento">
            <Input type="date" value={values.fecha_nacimiento} onChange={set("fecha_nacimiento")} />
          </Field>
          <Field label="Preferencias" full hint="Ej.: piso alto, cama doble, alergias alimentarias.">
            <Textarea value={values.preferencias} onChange={set("preferencias")} />
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

function nullsToEmpty(obj) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v ?? ""]));
}
