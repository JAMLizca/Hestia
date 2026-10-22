import { useState } from "react";
import { authApi } from "../../api/services";
import { Button, ErrorBanner } from "../ui";
import { Field, Input } from "../ui/Form";
import { Modal } from "../ui/Modal";
import { useToast } from "../../context/ToastContext";

const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72;

/** Cambio de la contraseña de quien tiene la sesión abierta (PUT /auth/me/password). */
export default function ChangePasswordModal({ onClose }) {
  const toast = useToast();
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (nueva.length < PASSWORD_MIN) return setError(`La contraseña nueva debe tener al menos ${PASSWORD_MIN} caracteres.`);
    if (nueva !== confirmar) return setError("Las contraseñas nuevas no coinciden.");
    setError("");
    setSaving(true);
    try {
      await authApi.changePassword({ password_actual: actual, password_nueva: nueva });
      toast.success("Contraseña actualizada");
      onClose();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Cambiar mi contraseña"
      subtitle="Tu sesión actual sigue abierta; usarás la nueva contraseña la próxima vez que inicies sesión."
      width={480}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="mi-password-form" loading={saving}>
            Guardar contraseña
          </Button>
        </>
      }
    >
      <form id="mi-password-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <Field label="Contraseña actual" required full>
            <Input type="password" autoComplete="current-password" value={actual} onChange={(e) => setActual(e.target.value)} maxLength={PASSWORD_MAX} required autoFocus />
          </Field>
          <Field label="Contraseña nueva" required full hint={`Entre ${PASSWORD_MIN} y ${PASSWORD_MAX} caracteres.`}>
            <Input type="password" autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} minLength={PASSWORD_MIN} maxLength={PASSWORD_MAX} required />
          </Field>
          <Field label="Confirmar contraseña nueva" required full>
            <Input type="password" autoComplete="new-password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} maxLength={PASSWORD_MAX} required />
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
