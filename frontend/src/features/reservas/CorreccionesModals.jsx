import { useState } from "react";
import { pagosApi, reservaServiciosApi } from "../../api/services";
import { Button, ErrorBanner, InfoBanner } from "../../components/ui";
import { Field, Input } from "../../components/ui/Form";
import { Modal } from "../../components/ui/Modal";
import { formatMoney } from "../../utils/format";

/** Hace la llamada, muestra el error dentro del modal y cierra al terminar bien. */
function useSubmit(fn, onDone) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event) {
    event?.preventDefault();
    setError("");
    setSaving(true);
    try {
      await fn();
      onDone();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }
  return { error, saving, submit };
}

/** Corrige la cantidad de un servicio consumido (PUT /reservas/{id}/servicios/{item}). */
export function CorregirConsumoModal({ reservaId, consumo, nombre, onClose, onSaved }) {
  const [cantidad, setCantidad] = useState(String(consumo.cantidad));
  const { error, saving, submit } = useSubmit(() => reservaServiciosApi.update(reservaId, consumo.id, { cantidad: Number(cantidad) }), onSaved);
  const valida = Number.isInteger(Number(cantidad)) && Number(cantidad) >= 1;
  return (
    <Modal
      title="Corregir consumo"
      subtitle={nombre}
      width={420}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Volver
          </Button>
          <Button type="submit" form="corregir-consumo" loading={saving} disabled={!valida || Number(cantidad) === consumo.cantidad}>
            Guardar
          </Button>
        </>
      }
    >
      <form id="corregir-consumo" onSubmit={submit}>
        <Field label="Cantidad" required hint={`Precio unitario ${formatMoney(consumo.precio_unitario)} (no cambia) · Subtotal ${formatMoney(Number(consumo.precio_unitario) * (valida ? Number(cantidad) : 0))}`}>
          <Input type="number" min={1} max={1000} step={1} value={cantidad} onChange={(e) => setCantidad(e.target.value)} autoFocus />
        </Field>
        {error && (
          <div style={{ marginTop: 16 }}>
            <ErrorBanner message={error} />
          </div>
        )}
      </form>
    </Modal>
  );
}

/** Corrige el monto o el método de un pago manual (PUT /reservas/{id}/pagos/{pago}). */
export function CorregirPagoModal({ reservaId, pago, onClose, onSaved }) {
  const [monto, setMonto] = useState(String(Number(pago.monto)));
  const [metodo, setMetodo] = useState(pago.metodo_pago);
  const cambios = {};
  if (Number(monto) !== Number(pago.monto)) cambios.monto = Number(monto);
  if (metodo.trim() !== pago.metodo_pago) cambios.metodo_pago = metodo.trim();
  const { error, saving, submit } = useSubmit(() => pagosApi.update(reservaId, pago.id, cambios), onSaved);
  return (
    <Modal
      title="Corregir pago"
      subtitle={`Pago de ${formatMoney(pago.monto)} · ${pago.metodo_pago}`}
      width={440}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Volver
          </Button>
          <Button type="submit" form="corregir-pago" loading={saving} disabled={!Object.keys(cambios).length || !(Number(monto) > 0) || !metodo.trim()}>
            Guardar
          </Button>
        </>
      }
    >
      <form id="corregir-pago" onSubmit={submit}>
        <div className="form-grid">
          <Field label="Monto" required>
            <Input type="number" min="0.01" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} autoFocus />
          </Field>
          <Field label="Método de pago" required>
            <Input maxLength={30} value={metodo} onChange={(e) => setMetodo(e.target.value)} />
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

/** Anula un pago manual dejando el motivo (POST /reservas/{id}/pagos/{pago}/anular). */
export function AnularPagoModal({ reservaId, pago, onClose, onSaved }) {
  const [motivo, setMotivo] = useState("");
  const { error, saving, submit } = useSubmit(() => pagosApi.anular(reservaId, pago.id, motivo.trim()), onSaved);
  return (
    <Modal
      title="Anular pago"
      subtitle={`Pago de ${formatMoney(pago.monto)} · ${pago.metodo_pago}`}
      width={440}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Volver
          </Button>
          <Button type="submit" form="anular-pago" variant="danger" loading={saving} disabled={motivo.trim().length < 3}>
            Anular pago
          </Button>
        </>
      }
    >
      <form id="anular-pago" onSubmit={submit}>
        <InfoBanner>El pago no se borra: queda registrado como anulado con este motivo y deja de sumar al total pagado.</InfoBanner>
        <div style={{ marginTop: 16 }}>
          <Field label="Motivo" required hint="Por ejemplo: cobro duplicado, error de digitación, devolución al huésped.">
            <Input maxLength={200} value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus />
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
