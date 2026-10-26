import { Clock, Sparkles } from "lucide-react";
import { useState } from "react";
import { PREFERENCIAS_BANDERAS, PREFERENCIAS_OPCIONES } from "../../utils/status";
import { MENSAJE_NO_DISPONIBLE, recomendarHabitaciones } from "./inteligencia";
import "./recomendacion.css";

/**
 * Recomendación de habitaciones (Hestia Intelligence). Dos usos:
 *  - variante "huesped": en la página de reservas, para quien está eligiendo. Pide sus preferencias.
 *  - variante "recepcion": en «Nueva reserva» del panel; usa las preferencias del huésped que ya se capturan arriba.
 * `contexto` = { llegada, salida, huespedes }. `preferencias`/`onPreferencias` son opcionales (si no se pasan, el
 * componente guarda las suyas). Mientras los modelos no estén conectados, cualquier uso muestra
 * «Opción no disponible temporalmente» (ver inteligencia.js).
 */
export default function RecomendacionHabitaciones({ variante = "huesped", contexto, preferencias, onPreferencias }) {
  const [propias, setPropias] = useState({ piso: "", vista: "", cama: "", tranquila: false, accesible: false });
  const [aviso, setAviso] = useState(false);
  const [busy, setBusy] = useState(false);
  const prefs = preferencias ?? propias;
  const setPrefs = onPreferencias ?? setPropias;
  const esHuesped = variante === "huesped";

  const set = (clave) => (e) => setPrefs({ ...prefs, [clave]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  async function recomendar() {
    setBusy(true);
    try {
      await recomendarHabitaciones({ ...contexto, preferencias: prefs });
    } catch {
      setAviso(true); // hoy los modelos no están conectados
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="hr" onInput={() => setAviso(true)}>
      <div className="hr__head">
        <span className="hr__eyebrow">
          <Sparkles size={12} /> Hestia Intelligence
        </span>
        <strong>{esHuesped ? "Recomendada para ti" : "Sugerir habitación"}</strong>
        <p>
          {esHuesped
            ? "Cuéntanos qué prefieres y te sugerimos la habitación que mejor se ajusta a tu estadía."
            : "Sugiere la habitación que mejor se ajusta a las preferencias del huésped."}
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
          <Sparkles size={14} /> {esHuesped ? "Recomendarme una habitación" : "Sugerir habitación"}
        </button>
        {aviso && (
          <span className="hr__aviso" role="alert">
            <Clock size={15} /> {MENSAJE_NO_DISPONIBLE}
          </span>
        )}
      </div>
    </div>
  );
}
