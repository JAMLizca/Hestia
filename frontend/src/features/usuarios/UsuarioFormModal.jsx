import { useState } from "react";
import { authApi, usuariosApi } from "../../api/services";
import { Button, ErrorBanner } from "../../components/ui";
import { Field, Input, Select } from "../../components/ui/Form";
import { Modal } from "../../components/ui/Modal";

const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72;

/** Valida una contraseña nueva; devuelve el mensaje de error o "". */
function validatePassword(password, confirm) {
  if (password.length < PASSWORD_MIN) return `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`;
  if (password.length > PASSWORD_MAX) return `La contraseña no puede superar ${PASSWORD_MAX} caracteres.`;
  if (password !== confirm) return "Las contraseñas no coinciden.";
  return "";
}

/**
 * Crear (POST /auth/register) o editar (PUT /usuarios/{id}) un usuario del staff.
 * Al editar no se toca la contraseña (tiene su propio diálogo) ni el estado activo
 * (se cambia con el botón activar/desactivar de la tabla).
 * Un administrador no puede cambiar su propio rol: el backend lo rechaza.
 */
export function UsuarioFormModal({ usuario, roles, esPropio, onClose, onSaved }) {
  const editing = Boolean(usuario);
  const [values, setValues] = useState({
    nombre: usuario?.nombre ?? "",
    email: usuario?.email ?? "",
    rol_id: usuario ? String(usuario.rol_id) : "",
    password: "",
    confirm: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));
  const roleOptions = roles.map((r) => ({ value: String(r.id), label: r.nombre.charAt(0).toUpperCase() + r.nombre.slice(1) }));

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (!editing) {
      const problem = validatePassword(values.password, values.confirm);
      if (problem) return setError(problem);
    }
    setSaving(true);
    try {
      const base = { nombre: values.nombre.trim(), email: values.email.trim(), rol_id: Number(values.rol_id) };
      const saved = editing
        ? await usuariosApi.update(usuario.id, base)
        : await authApi.register({ ...base, password: values.password });
      onSaved(saved);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal
      title={editing ? "Editar usuario" : "Nuevo usuario"}
      subtitle={editing ? usuario.email : "Crea una cuenta para el personal del hotel"}
      width={560}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="usuario-form" loading={saving}>
            {editing ? "Guardar cambios" : "Crear usuario"}
          </Button>
        </>
      }
    >
      <form id="usuario-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <Field label="Nombre completo" required full>
            <Input value={values.nombre} onChange={set("nombre")} maxLength={100} required autoFocus />
          </Field>
          <Field label="Correo electrónico" required>
            <Input type="email" value={values.email} onChange={set("email")} placeholder="nombre@hestia.co" required />
          </Field>
          <Field
            label="Rol"
            required
            hint={esPropio ? "No puedes cambiar tu propio rol." : "Define a qué módulos puede acceder."}
          >
            <Select
              options={roleOptions}
              placeholder="Selecciona un rol"
              value={values.rol_id}
              onChange={set("rol_id")}
              required
              disabled={esPropio}
            />
          </Field>
          {!editing && (
            <>
              <Field label="Contraseña" required hint={`Entre ${PASSWORD_MIN} y ${PASSWORD_MAX} caracteres.`}>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={values.password}
                  onChange={set("password")}
                  minLength={PASSWORD_MIN}
                  maxLength={PASSWORD_MAX}
                  required
                />
              </Field>
              <Field label="Confirmar contraseña" required>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={values.confirm}
                  onChange={set("confirm")}
                  maxLength={PASSWORD_MAX}
                  required
                />
              </Field>
            </>
          )}
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

/** Define una contraseña nueva para un usuario (PUT /usuarios/{id}/password). */
export function PasswordModal({ usuario, onClose, onSaved }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    const problem = validatePassword(password, confirm);
    if (problem) return setError(problem);
    setError("");
    setSaving(true);
    try {
      await usuariosApi.setPassword(usuario.id, password);
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Cambiar contraseña"
      subtitle={`${usuario.nombre} · ${usuario.email}`}
      width={480}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="password-form" loading={saving}>
            Guardar contraseña
          </Button>
        </>
      }
    >
      <form id="password-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <Field label="Nueva contraseña" required full hint={`Entre ${PASSWORD_MIN} y ${PASSWORD_MAX} caracteres.`}>
            <Input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={PASSWORD_MIN}
              maxLength={PASSWORD_MAX}
              required
              autoFocus
            />
          </Field>
          <Field label="Confirmar contraseña" required full>
            <Input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              maxLength={PASSWORD_MAX}
              required
            />
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