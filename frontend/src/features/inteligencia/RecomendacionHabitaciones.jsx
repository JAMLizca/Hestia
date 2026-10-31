import { Check, Clock, Sparkles } from "lucide-react";
import { useState } from "react";
import { formatMoney } from "../../utils/format";
import { PREFERENCIAS_BANDERAS, PREFERENCIAS_OPCIONES } from "../../utils/status";
import { recomendarHabitaciones } from "./inteligencia";
import "./recomendacion.css";

/**
 * Recomendación de habitaciones (Hestia Intelligence). Dos usos:
 *  - variante "huesped": en la página de reservas, para quien está eligiendo. Pide sus preferencias y sugiere TIPOS de
 *    habitación (GET /publico/recomendacion); recepción asigna el número al recibirlo.
 *  - variante "recepcion": en «Nueva reserva» del panel; usa las preferencias del huésped que ya se capturan arriba y
 *    sugiere HABITACIONES concretas (GET /recomendacion/habitaciones).
 * `contexto` = { llegada, salida, huespedes }. `preferencias`/`onPreferencias` son opcionales (si no se pasan, el
 * componente guarda las suyas). `onElegir(sugerencia)` se llama al pulsar «Elegir»; `seleccionada` es el id de la
 * habitación (recepción) o del tipo (huésped) que ya está elegido, para marcarla.
 */
export default function RecomendacionHabitaciones({ variante = "huesped", contexto, preferencias, onPreferencias, onElegir, seleccionada }) {
  const [propias, setPropias] = useState({ piso: "", vista: "", cama: "", tranquila: false, accesible: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [obtenido, setObtenido] = useState(null); // { clave, lista }: la clave identifica con qué datos se pidió
  const prefs = preferencias ?? propias;
  const setPrefs = onPreferencias ?? setPropias;
  const esHuesped = variante === "huesped";

  const set = (clave) => (e) => setPrefs({ ...prefs, [clave]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  // Si cambian las fechas, los huéspedes o las preferencias, lo sugerido antes ya no corresponde: se oculta.
  const clave = JSON.stringify([contexto, prefs]);
  const lista = obtenido?.clave === clave ? obtenido.lista : null;

  async function recomendar() {
    setBusy(true);
    setError("");
    const pedida = clave;
    try {
      const respuesta = await recomendarHabitaciones({ ...contexto, preferencias: prefs, publico: esHuesped });
      setObtenido({ clave: pedida, lista: respuesta });
    } catch (err) {
      setObtenido(null);
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="hr">
      <div className="hr__head">
        <span className="hr__eyebrow">
          <Sparkles size={12} /> Hestia Intelligence
        </span>
        <strong>{esHuesped ? "Recomendada para ti" : "Sugerir habitación"}</strong>
        <p>
          {esHuesped
            ? "Cuéntanos qué prefieres y te sugerimos el tipo de habitación que mejor se ajusta a tu estadía."
            : "Sugiere la habitación que mejor se ajusta a las preferencias del huésped y a lo que suelen elegir reservas parecidas."}
        </p>
      </div>

      {esHuesped && (
        <div className="hr__prefs">
          <label>
            Piso
            <select value={prefs.piso} onChange={set("piso")}>
              <option value="">Sin preferencia</option>
              {PREFERENCIAS_OPCIONES.piso.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Vista
            <select value={prefs.vista} onChange={set("vista")}>
              <option value="">Sin preferencia</option>
              {PREFERENCIAS_OPCIONES.vista.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Cama
            <select value={prefs.cama} onChange={set("cama")}>
              <option value="">Sin preferencia</option>
              {PREFERENCIAS_OPCIONES.cama.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <div className="hr__checks">
            {PREFERENCIAS_BANDERAS.map(({ key, label }) => (
              <label key={key}>
                <input type="checkbox" checked={prefs[key]} onChange={set(key)} /> {label}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="hr__foot">
        <button type="button" className="hr__btn" onClick={recomendar} disabled={busy}>
          <Sparkles size={14} /> {busy ? "Buscando…" : esHuesped ? "Recomendarme una habitación" : "Sugerir habitación"}
        </button>
        {error && (
          <span className="hr__aviso" role="alert">
            <Clock size={15} /> {error}
          </span>
        )}
      </div>

      {lista && (
        <div className="hr__res" aria-live="polite">
          {lista.length === 0 ? (
            <p className="hr__vacio">No encontramos un tipo de habitación libre que se ajuste a este grupo en esas fechas.</p>
          ) : (
            <ol className="hr__list">
              {lista.map((s, i) => {
                const elegida = esHuesped ? seleccionada === s.tipo_habitacion_id : seleccionada === s.habitacion_id;
                return (
                  <li key={s.habitacion_id ?? s.tipo_habitacion_id} className={`hr__card${i === 0 ? " hr__card--top" : ""}${elegida ? " hr__card--on" : ""}`}>
                    <div className="hr__card-main">
                      <div className="hr__card-title">
                        <span className="hr__rank">{i + 1}</span>
                        <strong>{s.numero ? `Habitación ${s.numero}` : s.tipo}</strong>
                        {s.numero && <span className="hr__tipo">{s.tipo}{s.piso != null ? ` · piso ${s.piso}` : ""}</span>}
                      </div>
                      <div className="hr__afinidad" title="Qué tan parecida es esta estadía a las reservas que suelen elegir este tipo de habitación">
                        <span className="hr__afinidad-bar" aria-hidden="true">
                          <i style={{ width: `${Math.min(s.afinidad_pct, 100)}%` }} />
                        </span>
                        <span>{s.afinidad_pct}% de afinidad</span>
                      </div>
                      <ul className="hr__motivos">
                        {s.motivos.map((m) => (
                          <li key={m}>{m}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="hr__card-side">
                      <strong>{formatMoney(s.precio_noche)}</strong>
                      <span>por noche</span>
                      {onElegir && (
                        <button type="button" className={`hr__elegir${elegida ? " hr__elegir--on" : ""}`} onClick={() => onElegir(s)}>
                          {elegida ? (
                            <>
                              <Check size={14} /> Elegida
                            </>
                          ) : (
                            "Elegir"
                          )}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          <p className="hr__nota">Sugerencia estadística basada en reservas anteriores del hotel; no reemplaza el criterio de quien atiende.</p>
        </div>
      )}
    </div>
  );
}
