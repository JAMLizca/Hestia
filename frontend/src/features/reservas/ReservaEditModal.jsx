import { useMemo, useState } from "react";
import { habitacionesApi, reservasApi, tiposHabitacionApi } from "../../api/services";
import { Button, ErrorBanner, InfoBanner, LoadingState } from "../../components/ui";
import { Field, Input, Select, Textarea } from "../../components/ui/Form";
import { Modal } from "../../components/ui/Modal";
import { indexById, useApiData } from "../../hooks/useApiData";
import { formatMoney, nights, todayISO } from "../../utils/format";
import { dateOnly } from "../../utils/hotel";
import { CANALES, RESERVA_ESTADOS } from "../../utils/status";
import { mismasPreferencias, preferenciasDesde, preferenciasPayload } from "../../utils/preferencias";
import PreferenciasFields from "./PreferenciasFields";
import "./reservas.css";

// Qué puede cambiar cada estado (debe coincidir con _CAMPOS_EDITABLES en routes/reservas.py).
const TODOS = ["habitacion_id", "fecha_checkin_prevista", "fecha_checkout_prevista", "num_huespedes", "canal", "notas", "preferencias"];
const CAMPOS_EDITABLES = {
  pendiente: TODOS,
  confirmada: TODOS,
  checkin: ["fecha_checkout_prevista", "num_huespedes", "notas"],
};

function addDays(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  return todayISO(new Date(y, m - 1, d + days));
}

/**
 * Edición de una reserva (PUT /reservas/{id}). Qué campos se pueden tocar depende del estado:
 * pendiente/confirmada casi todo; en check-in solo la salida, los huéspedes y las notas;
 * en cualquier otro estado, solo las notas. El backend vuelve a validar disponibilidad,
 * capacidad y precio, y responde con el motivo si algo no es posible.
 */
export default function ReservaEditModal({ reserva, huesped, onClose, onSaved }) {
  const { data, loading, error: loadError } = useApiData({
    habitaciones: () => habitacionesApi.list(),
    tipos: () => tiposHabitacionApi.list(),
  });
  const editable = CAMPOS_EDITABLES[reserva.estado] ?? ["notas"];
  const can = (campo) => editable.includes(campo);
  const estado = RESERVA_ESTADOS[reserva.estado];

  const [values, setValues] = useState({
    habitacion_id: String(reserva.habitacion_id),
    fecha_checkin_prevista: dateOnly(reserva.fecha_checkin_prevista),
    fecha_checkout_prevista: dateOnly(reserva.fecha_checkout_prevista),
    num_huespedes: String(reserva.num_huespedes),
    canal: reserva.canal ?? "presencial",
    notas: reserva.notas ?? "",
  });
  const [prefs, setPrefs] = useState(() => preferenciasDesde(reserva.preferencias));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  const tipos = useMemo(() => indexById(data.tipos), [data.tipos]);
  const habitaciones = useMemo(() => data.habitaciones ?? [], [data.habitaciones]);
  const habitacion = habitaciones.find((h) => String(h.id) === values.habitacion_id);
  const tipo = habitacion && tipos[habitacion.tipo_habitacion_id];

  const noches = nights(values.fecha_checkin_prevista, values.fecha_checkout_prevista);
  const fechasValidas = values.fecha_checkin_prevista && values.fecha_checkout_prevista && noches > 0;
  const nuevoTotal = tipo && fechasValidas ? Number(tipo.precio_base) * noches : null;

  /** Solo se envía lo que cambió: el backend rechaza campos no editables en el estado actual. */
  const cambios = {};
  if (can("habitacion_id") && Number(values.habitacion_id) !== reserva.habitacion_id) cambios.habitacion_id = Number(values.habitacion_id);
  if (can("fecha_checkin_prevista") && values.fecha_checkin_prevista !== dateOnly(reserva.fecha_checkin_prevista))
    cambios.fecha_checkin_prevista = values.fecha_checkin_prevista;
  if (can("fecha_checkout_prevista") && values.fecha_checkout_prevista !== dateOnly(reserva.fecha_checkout_prevista))
    cambios.fecha_checkout_prevista = values.fecha_checkout_prevista;
  if (can("num_huespedes") && Number(values.num_huespedes) !== reserva.num_huespedes) cambios.num_huespedes = Number(values.num_huespedes);
  if (can("canal") && values.canal !== (reserva.canal ?? "presencial")) cambios.canal = values.canal;
  if (can("notas") && values.notas.trim() !== (reserva.notas ?? "")) cambios.notas = values.notas.trim() || null;
  if (can("preferencias") && !mismasPreferencias(prefs, preferenciasDesde(reserva.preferencias))) cambios.preferencias = preferenciasPayload(prefs) ?? {};
  const hayCambios = Object.keys(cambios).length > 0;
  const cambiaPrecio = ["habitacion_id", "fecha_checkin_prevista", "fecha_checkout_prevista"].some((k) => k in cambios);

  const opcionesHabitacion = habitaciones
    .filter((h) => h.estado !== "mantenimiento" || h.id === reserva.habitacion_id)
    .sort((a, b) => String(a.numero).localeCompare(String(b.numero), undefined, { numeric: true }))
    .map((h) => {
      const t = tipos[h.tipo_habitacion_id];
      return { value: String(h.id), label: `${h.numero} · ${t?.nombre ?? "—"}${t ? ` · ${formatMoney(t.precio_base)}/noche` : ""}` };
    });

  async function handleSubmit(event) {
    event.preventDefault();
    if (!hayCambios) return onClose();
    setError("");
    setSaving(true);
    try {
      const actualizada = await reservasApi.update(reserva.id, cambios);
      onSaved(actualizada);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal
      title={`Editar reserva ${reserva.codigo ?? `#${reserva.id}`}`}
      subtitle={huesped ? `${huesped.nombres} ${huesped.apellidos} · ${estado?.label ?? reserva.estado}` : estado?.label}
      width={640}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="reserva-edit-form" loading={saving} disabled={loading || !hayCambios || (cambiaPrecio && !fechasValidas)}>
            Guardar cambios
          </Button>
        </>
      }
    >
      {loading ? (
        <LoadingState />
      ) : (
        <form id="reserva-edit-form" onSubmit={handleSubmit}>
          {!can("habitacion_id") && (
            <div style={{ marginBottom: 16 }}>
              <InfoBanner>
                {can("fecha_checkout_prevista")
                  ? "El huésped ya hizo check-in: solo se puede cambiar la salida prevista, el número de huéspedes y las notas."
                  : `Una reserva en estado “${estado?.label ?? reserva.estado}” ya no se puede modificar; solo se pueden editar las notas.`}
              </InfoBanner>
            </div>
          )}
          <ErrorBanner message={loadError} />

          <div className="form-grid">
            <Field label="Habitación" required full>
              <Select options={opcionesHabitacion} value={values.habitacion_id} onChange={set("habitacion_id")} disabled={!can("habitacion_id")} />
            </Field>
            <Field label="Check-in" required>
              <Input
                type="date"
                value={values.fecha_checkin_prevista}
                onChange={(e) => {
                  const nuevo = e.target.value;
                  setValues((v) => ({
                    ...v,
                    fecha_checkin_prevista: nuevo,
                    fecha_checkout_prevista: nuevo && v.fecha_checkout_prevista <= nuevo ? addDays(nuevo, 1) : v.fecha_checkout_prevista,
                  }));
                }}
                disabled={!can("fecha_checkin_prevista")}
                required
              />
            </Field>
            <Field label="Check-out" required>
              <Input
                type="date"
                value={values.fecha_checkout_prevista}
                min={values.fecha_checkin_prevista ? addDays(values.fecha_checkin_prevista, 1) : undefined}
                onChange={set("fecha_checkout_prevista")}
                disabled={!can("fecha_checkout_prevista")}
                required
              />
            </Field>
            <Field
              label="Huéspedes"
              required
              hint={tipo ? `Esta habitación admite hasta ${tipo.capacidad_maxima}.` : undefined}
            >
              <Input
                type="number"
                min={1}
                value={values.num_huespedes}
                onChange={(e) => setValues((v) => ({ ...v, num_huespedes: String(Math.max(1, Number(e.target.value) || 1)) }))}
                disabled={!can("num_huespedes")}
                required
              />
            </Field>
            <Field label="Canal" required>
              <Select options={CANALES} value={values.canal} onChange={set("canal")} disabled={!can("canal")} />
            </Field>
            <Field label="Notas" full hint={`${values.notas.length}/500`}>
              <Textarea rows={3} maxLength={500} value={values.notas} onChange={set("notas")} />
            </Field>
            {can("preferencias") && (
              <div className="field field--full">
                <span className="field__label">
                  Preferencias del huésped<small> (opcional)</small>
                </span>
                <PreferenciasFields value={prefs} onChange={setPrefs} />
              </div>
            )}
          </div>

          {cambiaPrecio && (
            <div style={{ marginTop: 16 }}>
              {fechasValidas && nuevoTotal != null ? (
                <InfoBanner>
                  <div className="reserva-edit__summary">
                    <span>
                      {noches} {noches === 1 ? "noche" : "noches"} × {formatMoney(tipo.precio_base)}
                    </span>
                    <span>
                      Total estimado: <strong>{formatMoney(nuevoTotal)}</strong> (antes {formatMoney(reserva.precio_total)})
                    </span>
                  </div>
                </InfoBanner>
              ) : (
                <ErrorBanner message="La salida debe ser posterior a la entrada." />
              )}
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <ErrorBanner message={error} />
          </div>
        </form>
      )}
    </Modal>
  );
}
