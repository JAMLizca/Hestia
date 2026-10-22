import { useState } from "react";
import { rolesApi } from "../../api/services";
import { Button, ErrorBanner } from "../../components/ui";
import { Field, Input, Textarea } from "../../components/ui/Form";
import { Modal } from "../../components/ui/Modal";
import { rolLabel } from "../../utils/roles";

export default function RoleFormModal({ rol, onClose, onSaved }) {
  const editing = Boolean(rol);
  const [nombre, setNombre] = useState(rol?.nombre ?? "");
  const [description, setDescription] = useState(rol?.description ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const texto = description.trim() || null;
      const saved = editing
        ? await rolesApi.update(rol.id, { description: texto })
        : await rolesApi.create({ nombre: nombre.trim(), description: texto });
      onSaved(saved);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal
      title={editing ? "Editar rol" : "Nuevo rol"}
      subtitle={editing ? rolLabel(rol.nombre) : "Un rol nuevo solo accede a lo que está abierto a cualquier usuario autenticado"}
      width={520}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="rol-form" loading={saving}>
            {editing ? "Guardar cambios" : "Crear rol"}
          </Button>
        </>
      }
    >
      <form id="rol-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <Field
            label="Nombre"
            required
            full
            hint={editing ? "El nombre no se puede cambiar." : "Se guarda en minúsculas y después no se puede cambiar."}
          >
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={50} required disabled={editing} autoFocus={!editing} />
          </Field>
          <Field label="Descripción" full hint="Para qué sirve este rol (máximo 255 caracteres).">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={255} autoFocus={editing} />
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