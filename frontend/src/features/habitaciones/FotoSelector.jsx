import { Check } from "lucide-react";
import { FOTOS_DISPONIBLES, fotoDeTipo } from "../../utils/fotosHabitacion";
import "./FotoSelector.css";

/**
 * Galería para elegir la foto de una habitación.
 * Primera opción: "Automática" (la foto del tipo de habitación).
 * `value` es el id de la foto elegida ("" = automática).
 */
export default function FotoSelector({ value, onChange, nombreTipo }) {
  const opciones = [{ id: "", etiqueta: "Automática (según el tipo)", url: fotoDeTipo(nombreTipo) }, ...FOTOS_DISPONIBLES];

  return (
    <div className="foto-sel" role="radiogroup" aria-label="Foto de la habitación">
      {opciones.map((f) => {
        const activa = (value || "") === f.id;
        return (
          <button
            key={f.id || "auto"}
            type="button"
            role="radio"
            aria-checked={activa}
            className={`foto-sel__item${activa ? " foto-sel__item--on" : ""}`}
            onClick={() => onChange(f.id)}
            title={f.etiqueta}
          >
            <img src={f.url} alt="" loading="lazy" />
            <span className="foto-sel__label">{f.etiqueta}</span>
            {activa && (
              <span className="foto-sel__check" aria-hidden="true">
                <Check size={14} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
