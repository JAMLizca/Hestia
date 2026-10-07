import { useState } from "react";
import { reservaServiciosApi } from "../../api/services";
import { Button, ErrorBanner, InfoBanner } from "../../components/ui";
import { Field, Input, Select } from "../../components/ui/Form";
import { Modal } from "../../components/ui/Modal";
import { formatMoney } from "../../utils/format";
import { ESTADOS_MODIFICABLES, fullName } from "../../utils/hotel";
import { RESERVA_ESTADOS } from "../../utils/status";

/**
 * Registrar el consumo de un servicio en una reserva (POST /reservas/{id}/servicios/).
 * El backend congela el precio del catálogo en el momento del registro.
 */
export default function ConsumoFormModal({ reservas, catalogo, huespedes, habitaciones, onClose, onSaved }) {
  const activas = reservas.filter((r) => ESTADOS_MODIFICABLES.includes(r.estado)).sort((a, b) => b.id - a.id);
  const [reservaId, setReservaId] = useState(activas.length === 1 ? String(activas[0].id) : "");
  const [servicioId, setServicioId] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const servicio = catalogo.find((s) => String(s.id) === servicioId);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const saved = await reservaServiciosApi.add(Number(reservaId), { servicio_id: Number(servicioId), cantidad: Number(cantidad) });
      onSaved(saved);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Registrar consumo de servicio"
      subtitle="El servicio se suma al costo total de la reserva"
      width={520}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="consumo-form" loading={saving} disabled={!reservaId || !servicioId}>
            Registrar consumo
          </Button>
        </>
      }
    >
      {!activas.length || !catalogo.length ? (
        <InfoBanner>
          {!activas.length
            ? "No hay reservas pendientes, confirmadas o en check-in a las que se pueda agregar un servicio."
            : "El catálogo de servicios está vacío. Crea un servicio en la pestaña “Catálogo”."}
        </InfoBanner>
      ) : (
        <form id="consumo-form" onSubmit={handleSubmit}>
          <div className="form-grid">
            <Field label="Reserva" required full>
              <Select
                placeholder="Selecciona una reserva"
                value={reservaId}
                onChange={(e) => setReservaId(e.target.value)}
                options={activas.map((r) => ({
                  value: String(r.id),
                  label: `#${r.id} · ${fullName(huespedes[r.huesped_id])} · Hab. ${habitaciones[r.habitacion_id]?.numero ?? "—"} (${RESERVA_ESTADOS[r.estado].label})`,
                }))}
              />
            </Field>
            <Field label="Servicio" required>
              <Select
                placeholder="Selecciona un servicio"
                value={servicioId}
                onChange={(e) => setServicioId(e.target.value)}
                options={catalogo.map((s) => ({ value: String(s.id), label: s.nombre }))}
              />
            </Field>
            <Field label="Cantidad" required hint={servicio ? `Subtotal: ${formatMoney(Number(servicio.precio) * cantidad)}` : undefined}>
              <Input type="number" min={1} value={cantidad} onChange={(e) => setCantidad(Math.max(1, Number(e.target.value) || 1))} />
            </Field>
          </div>
          {error && (
            <div style={{ marginTop: 16 }}>
              <ErrorBanner message={error} />
            </div>
          )}
        </form>
      )}
    </Modal>
  );
}
