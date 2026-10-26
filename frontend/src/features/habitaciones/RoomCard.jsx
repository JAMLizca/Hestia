import { Pencil, Sparkles, Trash2 } from "lucide-react";
import { IconButton } from "../../components/ui";
import { formatMoney } from "../../utils/format";
import { fotoDeHabitacion, textoCaracteristicas } from "../../utils/fotosHabitacion";
import { COLORS, HABITACION_ESTADOS } from "../../utils/status";
import "./RoomCard.css";

/**
 * Tarjeta de habitación según el diseño enviado (foto, número, nombre, estado,
 * piso y capacidad). El backend no guarda fotos: la foto sale de
 * `utils/fotosHabitacion` (elegida en la habitación → la del tipo → la general).
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
        <img src={fotoDeHabitacion(habitacion, tipo)} alt="" loading="lazy" />
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
        {textoCaracteristicas(habitacion.caracteristicas) && <p className="room-card__features">{textoCaracteristicas(habitacion.caracteristicas)}</p>}

        <div className="room-card__footer">
          <span className="room-card__price">{tipo ? `${formatMoney(tipo.precio_base)} / noche` : ""}</span>
          <div className="icon-actions">
            {habitacion.estado === "limpieza" && onMarkAvailable && (
              <IconButton icon={Sparkles} title="Marcar como disponible (limpieza terminada)" color={COLORS.green} disabled={busy} onClick={onMarkAvailable} />
            )}
            {onEdit && <IconButton icon={Pencil} title="Editar" color={COLORS.navy} onClick={onEdit} />}
            {onDelete && <IconButton icon={Trash2} title="Eliminar" color={COLORS.red} onClick={onDelete} />}
          </div>
        </div>
      </div>
    </article>
  );
}
