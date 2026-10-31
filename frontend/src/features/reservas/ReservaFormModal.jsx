import { BedDouble, Search, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { disponibilidadApi, reservasApi } from "../../api/services";
import { Button, EmptyState, ErrorBanner, InfoBanner, LoadingState } from "../../components/ui";
import { Field, Input, Select, Textarea } from "../../components/ui/Form";
import { Modal } from "../../components/ui/Modal";
import { indexById } from "../../hooks/useApiData";
import { formatMoney, nights, todayISO } from "../../utils/format";
import { fullName, matches, onlyDigits } from "../../utils/hotel";
import { CANALES } from "../../utils/status";
import HuespedFormModal from "../huespedes/HuespedFormModal";
import RecomendacionHabitaciones from "../inteligencia/RecomendacionHabitaciones";
import { PREFERENCIAS_VACIAS, preferenciasPayload } from "../../utils/preferencias";
import PreferenciasFields from "./PreferenciasFields";
import "./reservas.css";

function addDays(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  return todayISO(new Date(y, m - 1, d + days));
}

/**
 * Nueva reserva:
 * 1. Huésped (se busca por nombre, documento o teléfono, o se registra uno nuevo), canal y notas.
 * 2. Fechas + tipo → GET /disponibilidad/ devuelve las habitaciones libres.
 * 3. POST /reservas/ — el backend valida solapamientos y calcula el precio.
 */
export default function ReservaFormModal({ huespedes, tipos, initialHuespedId, onClose, onCreated, onGuestCreated }) {
  const [guests, setGuests] = useState(huespedes);
  const [huespedId, setHuespedId] = useState(initialHuespedId ? String(initialHuespedId) : "");
  const [guestQuery, setGuestQuery] = useState("");
  const [canal, setCanal] = useState("presencial");
  const [notas, setNotas] = useState("");
  const [preferencias, setPreferencias] = useState(PREFERENCIAS_VACIAS);
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
        canal,
        notas: notas.trim() || null,
        preferencias: preferenciasPayload(preferencias),
      });
      onCreated(reserva);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  // Con búsqueda activa solo se listan las coincidencias (y siempre el huésped ya elegido).
  const digits = onlyDigits(guestQuery);
  const guestMatches = (h) =>
    String(h.id) === huespedId ||
    matches(guestQuery, fullName(h), h.documento_identidad, h.telefono) ||
    (digits.length >= 4 && onlyDigits(h.telefono).includes(digits));
  const visibleGuests = guests.filter(guestMatches);
  const guestOptions = visibleGuests
    .slice()
    .sort((a, b) => fullName(a).localeCompare(fullName(b)))
    .map((h) => ({
      value: String(h.id),
      label: `${fullName(h)} — ${h.tipo_documento} ${h.documento_identidad}${h.telefono ? ` · ${h.telefono}` : ""}`,
    }));

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
      subtitle="Selecciona el huésped, el canal, las fechas y una habitación disponible"
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
          <h4 className="reserva-form__step">1. Huésped y origen</h4>
          <div className="reserva-form__guest">
            <Field label="Buscar huésped" hint="Por nombre, documento o teléfono (útil cuando llaman).">
              <Input type="search" value={guestQuery} onChange={(e) => setGuestQuery(e.target.value)} placeholder="Ej. 300 123 4567" />
            </Field>
            <Button variant="outline" icon={UserPlus} onClick={() => setShowGuestForm(true)}>
              Registrar nuevo
            </Button>
          </div>
          <div className="reserva-form__guest-select">
            <Field label="Huésped" required>
              <Select
                options={guestOptions}
                placeholder={
                  !guests.length
                    ? "No hay huéspedes registrados"
                    : guestQuery && !visibleGuests.length
                      ? "Ningún huésped coincide: regístralo"
                      : `Selecciona un huésped${guestQuery ? ` (${visibleGuests.length} coincidencias)` : ""}`
                }
                value={huespedId}
                onChange={(e) => setHuespedId(e.target.value)}
              />
            </Field>
          </div>
          <div className="reserva-form__origin">
            <Field label="Canal" required>
              <Select options={CANALES} value={canal} onChange={(e) => setCanal(e.target.value)} />
            </Field>
            <Field label="Notas" hint="Hora de llegada, peticiones, quién llamó…">
              <Textarea rows={2} maxLength={500} value={notas} onChange={(e) => setNotas(e.target.value)} />
            </Field>
          </div>
          <details className="reserva-form__prefs">
            <summary>Preferencias del huésped (opcional)</summary>
            <PreferenciasFields value={preferencias} onChange={setPreferencias} />
          </details>
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
              <>
              <RecomendacionHabitaciones
                variante="recepcion"
                contexto={{ llegada: checkin, salida: checkout, huespedes: Number(numHuespedes) }}
                preferencias={preferencias}
                onPreferencias={setPreferencias}
                seleccionada={habitacionId}
                onElegir={(s) => disponibles.some((h) => h.id === s.habitacion_id) && setHabitacionId(s.habitacion_id)}
              />
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
              </>
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
