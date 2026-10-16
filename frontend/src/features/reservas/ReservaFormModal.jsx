import { BedDouble, Search, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { disponibilidadApi, reservasApi } from "../../api/services";
import { Button, EmptyState, ErrorBanner, InfoBanner, LoadingState } from "../../components/ui";
import { Field, Input, Select } from "../../components/ui/Form";
import { Modal } from "../../components/ui/Modal";
import { indexById } from "../../hooks/useApiData";
import { formatMoney, nights, todayISO } from "../../utils/format";
import { fullName } from "../../utils/hotel";
import HuespedFormModal from "../huespedes/HuespedFormModal";
import "./reservas.css";

function addDays(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  return todayISO(new Date(y, m - 1, d + days));
}

/**
 * Nueva reserva:
 * 1. Huésped (existente o registro rápido).
 * 2. Fechas + tipo → GET /disponibilidad/ devuelve las habitaciones libres.
 * 3. POST /reservas/ — el backend valida solapamientos y calcula el precio.
 */
export default function ReservaFormModal({ huespedes, tipos, initialHuespedId, onClose, onCreated, onGuestCreated }) {
  const [guests, setGuests] = useState(huespedes);
  const [huespedId, setHuespedId] = useState(initialHuespedId ? String(initialHuespedId) : "");
  const [checkin, setCheckin] = useState(todayISO());
  const [checkout, setCheckout] = useState(addDays(todayISO(), 1));
  const [numHuespedes, setNumHuespedes] = useState(1);
  const [tipoId, setTipoId] = useState("");
  const [disponibles, setDisponibles] = useState(null);
  const [habitacionId, setHabitacionId] = useState(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showGuestForm, setShowGuestForm] = useState(false);

  const tiposById = useMemo(() => indexById(tipos), [tipos]);
  const noches = nights(checkin, checkout);
  const fechasValidas = checkin && checkout && noches > 0;
  const habitacion = disponibles?.find((h) => h.id === habitacionId);
  const tipoSeleccionado = habitacion && tiposById[habitacion.tipo_habitacion_id];

  // Si cambian los criterios, la búsqueda anterior deja de ser válida.
  function resetSearch() {
    setDisponibles(null);
    setHabitacionId(null);
  }

  async function buscar() {
    setError("");
    setSearching(true);
    resetSearch();
    try {
      const rooms = await disponibilidadApi.check({
        fecha_checkin: checkin,
        fecha_checkout: checkout,
        tipo_habitacion_id: tipoId || undefined,
      });
      setDisponibles(rooms);
    } catch (err) {
      setError(err.message);
    } finally {
      setSearching(false);
    }
  }

  async function crear() {
    setError("");
    setSaving(true);
    try {
      const reserva = await reservasApi.create({
        huesped_id: Number(huespedId),
        habitacion_id: habitacionId,
        fecha_checkin_prevista: checkin,
        fecha_checkout_prevista: checkout,
        num_huespedes: Number(numHuespedes),
      });
      onCreated(reserva);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  const guestOptions = guests
    .slice()
    .sort((a, b) => fullName(a).localeCompare(fullName(b)))
    .map((h) => ({ value: String(h.id), label: `${fullName(h)} — ${h.tipo_documento} ${h.documento_identidad}` }));

  if (showGuestForm) {
    return (
      <HuespedFormModal
        onClose={() => setShowGuestForm(false)}
        onSaved={(nuevo) => {
          setGuests((list) => [...list, nuevo]);
          setHuespedId(String(nuevo.id));
          setShowGuestForm(false);
          onGuestCreated?.(nuevo);
        }}
      />
    );
  }

  return (
    <Modal
      title="Nueva reserva"
      subtitle="Selecciona el huésped, las fechas y una habitación disponible"
      width={720}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={crear} loading={saving} disabled={!huespedId || !habitacionId || !fechasValidas}>
            Crear reserva
          </Button>
        </>
      }
    >
      <div className="reserva-form">
        <section>
          <h4 className="reserva-form__step">1. Huésped</h4>
          <div className="reserva-form__guest">
            <Field label="Huésped" required>
              <Select
                options={guestOptions}
                placeholder={guests.length ? "Selecciona un huésped" : "No hay huéspedes registrados"}
                value={huespedId}
                onChange={(e) => setHuespedId(e.target.value)}
              />
            </Field>
            <Button variant="outline" icon={UserPlus} onClick={() => setShowGuestForm(true)}>
              Registrar nuevo
            </Button>
          </div>
        </section>

        <section>
          <h4 className="reserva-form__step">2. Fechas y disponibilidad</h4>
          <div className="reserva-form__dates">
            <Field label="Check-in" required>
              <Input
                type="date"
                value={checkin}
                onChange={(e) => {
                  setCheckin(e.target.value);
                  if (e.target.value && checkout <= e.target.value) setCheckout(addDays(e.target.value, 1));
                  resetSearch();
                }}
              />
            </Field>
            <Field label="Check-out" required>
              <Input
                type="date"
                value={checkout}
                min={checkin ? addDays(checkin, 1) : undefined}
                onChange={(e) => {
                  setCheckout(e.target.value);
                  resetSearch();
                }}
              />
            </Field>
            <Field label="Huéspedes" required>
              <Input
                type="number"
                min={1}
                value={numHuespedes}
                onChange={(e) => setNumHuespedes(Math.max(1, Number(e.target.value) || 1))}
              />
            </Field>
            <Field label="Tipo de habitación">
              <Select
                options={tipos.map((t) => ({ value: String(t.id), label: t.nombre }))}
                placeholder="Todos los tipos"
                value={tipoId}
                onChange={(e) => {
                  setTipoId(e.target.value);
                  resetSearch();
                }}
              />
            </Field>
          </div>
          <div className="reserva-form__search-row">
            <span className="muted" style={{ fontSize: 12 }}>
              {fechasValidas ? `${noches} ${noches === 1 ? "noche" : "noches"}` : "La salida debe ser posterior a la entrada"}
            </span>
            <Button variant="gold" icon={Search} onClick={buscar} loading={searching} disabled={!fechasValidas}>
              Buscar disponibilidad
            </Button>
          </div>
        </section>

        {searching && <LoadingState text="Consultando habitaciones disponibles…" />}

        {disponibles && (
          <section>
            <h4 className="reserva-form__step">3. Habitación ({disponibles.length} disponibles)</h4>
            {disponibles.length === 0 ? (
              <EmptyState
                icon={BedDouble}
                title="Sin habitaciones disponibles"
                text="No hay habitaciones libres para esas fechas. Prueba con otras fechas u otro tipo."
              />
            ) : (
              <div className="room-options">
                {disponibles.map((h) => {
                  const tipo = tiposById[h.tipo_habitacion_id];
                  const excede = tipo && Number(numHuespedes) > tipo.capacidad_maxima;
                  return (
                    <button
                      key={h.id}
                      type="button"
                      className={`room-option${habitacionId === h.id ? " room-option--selected" : ""}`}
                      onClick={() => setHabitacionId(h.id)}
                      aria-pressed={habitacionId === h.id}
                    >
                      <span className="room-option__number">{h.numero}</span>
                      <span className="room-option__type">{tipo?.nombre ?? "—"}</span>
                      <span className="room-option__meta">
                        {h.piso != null ? `Piso ${h.piso} · ` : ""}
                        {tipo ? `Hasta ${tipo.capacidad_maxima} pers.` : ""}
                      </span>
                      <span className="room-option__price">{tipo ? `${formatMoney(tipo.precio_base)} / noche` : ""}</span>
                      {excede && <span className="room-option__warn">Capacidad menor al número de huéspedes</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {habitacion && tipoSeleccionado && (
          <InfoBanner>
            Habitación {habitacion.numero} · {noches} {noches === 1 ? "noche" : "noches"} × {formatMoney(tipoSeleccionado.precio_base)} ={" "}
            <strong>{formatMoney(Number(tipoSeleccionado.precio_base) * noches)}</strong> (valor estimado; el backend calcula el
            precio final al crear la reserva).
          </InfoBanner>
        )}

        <ErrorBanner message={error} />
      </div>
    </Modal>
  );
}
