import { Pencil, Sparkles, Trash2 } from "lucide-react";
import fotoHabitacion from "../../assets/habitacion.webp";
import { IconButton } from "../../components/ui";
import { formatMoney } from "../../utils/format";
import { COLORS, HABITACION_ESTADOS } from "../../utils/status";
import "./RoomCard.css";

/**
 * Tarjeta de habitación según el diseño enviado (foto, número, nombre, estado,
 * piso y capacidad). El backend no guarda fotos ni nombres por habitación:
 * se usa la foto general del hotel y el nombre del tipo de habitación.
 */
export default function RoomCard({ habitacion, tipo, busy, onEdit, onDelete, onMarkAvailable }) {
  const estado = HABITACION_ESTADOS[habitacion.estado];
  const detalles = [
    habitacion.piso != null ? `Piso ${habitacion.piso}` : null,
    tipo ? `Hasta ${tipo.capacidad_maxima} ${tipo.capacidad_maxima === 1 ? "huésped" : "huéspedes"}` : null,
  ].filter(Boolean);

  return (
    <article className="room-card">
      <div className="room-card__media">
        <img src={fotoHabitacion} alt="" loading="lazy" />
        <span className="room-card__number">#{habitacion.numero}</span>
      </div>

      <div className="room-card__body">
        <div className="room-card__head">
          <h3 className="room-card__title">{tipo?.nombre ?? "Habitación"}</h3>
          <span className="room-card__status" style={{ color: estado?.color }}>
            <span className="room-card__dot" style={{ background: estado?.color }} />
            {estado?.label ?? habitacion.estado}
          </span>
        </div>
        <p className="room-card__meta">{detalles.join(" · ") || "—"}</p>
        {habitacion.caracteristicas && <p className="room-card__features">{habitacion.caracteristicas}</p>}

        <div className="room-card__footer">
          <span className="room-card__price">{tipo ? `${formatMoney(tipo.precio_base)} / noche` : ""}</span>
          <div className="icon-actions">
            {habitacion.estado === "limpieza" && (
              <IconButton icon={Sparkles} title="Marcar como disponible (limpieza terminada)" color={COLORS.green} disabled={busy} onClick={onMarkAvailable} />
            )}
            <IconButton icon={Pencil} title="Editar" color={COLORS.navy} onClick={onEdit} />
            <IconButton icon={Trash2} title="Eliminar" color={COLORS.red} onClick={onDelete} />
          </div>
        </div>
      </div>
    </article>
  );
}
