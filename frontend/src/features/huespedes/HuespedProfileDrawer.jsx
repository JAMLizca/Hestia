import { CalendarPlus, History, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { huespedesApi } from "../../api/services";
import { Avatar, Badge, Button, Chip, EmptyState, TableView } from "../../components/ui";
import { ConfirmDialog, Drawer } from "../../components/ui/Modal";
import { useToast } from "../../context/ToastContext";
import { formatMoney, formatShortDate, nights, parseDate } from "../../utils/format";
import { fullName } from "../../utils/hotel";
import { RESERVA_ESTADOS } from "../../utils/status";

/** Perfil del huésped con su historial de estadías (reservas filtradas por huesped_id). */
export default function HuespedProfileDrawer({ huesped, reservas, habitaciones, onClose, onEdit, onNewReserva, onOpenReserva, onDeleted }) {
  const toast = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const historial = [...reservas].sort((a, b) => String(b.fecha_checkin_prevista).localeCompare(String(a.fecha_checkin_prevista)));
  const estadias = reservas.filter((r) => r.estado === "checkout").length;
  const totalNoches = reservas
    .filter((r) => r.estado !== "cancelada")
    .reduce((acc, r) => acc + nights(r.fecha_checkin_prevista, r.fecha_checkout_prevista), 0);

  async function remove() {
    setDeleting(true);
    try {
      await huespedesApi.remove(huesped.id);
      toast.success("Huésped eliminado");
      onDeleted();
    } catch (err) {
      toast.error(err.message);
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  const nacimiento = parseDate(huesped.fecha_nacimiento);

  return (
    <Drawer
      title={fullName(huesped)}
      subtitle={`${huesped.tipo_documento} ${huesped.documento_identidad}`}
      headerExtra={
        <div style={{ marginTop: 10 }}>
          <Avatar name={huesped.nombres} size={40} />
        </div>
      }
      width={560}
      onClose={onClose}
    >
      <div className="reserva-detail__actions">
        <Button icon={CalendarPlus} onClick={onNewReserva}>
          Nueva reserva
        </Button>
        <Button variant="outline" icon={Pencil} onClick={onEdit}>
          Editar datos
        </Button>
        <Button variant="danger" icon={Trash2} onClick={() => setConfirmDelete(true)} disabled={reservas.length > 0} title={reservas.length > 0 ? "El backend no permite eliminar huéspedes con reservas" : undefined}>
          Eliminar
        </Button>
      </div>

      <dl className="detail-grid">
        <div>
          <dt>Correo</dt>
          <dd>{huesped.email || "—"}</dd>
        </div>
        <div>
          <dt>Teléfono</dt>
          <dd>{huesped.telefono || "—"}</dd>
        </div>
        <div>
          <dt>Nacionalidad</dt>
          <dd>{huesped.nacionalidad || "—"}</dd>
        </div>
        <div>
          <dt>Fecha de nacimiento</dt>
          <dd>{nacimiento ? nacimiento.toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" }) : "—"}</dd>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <dt>Preferencias</dt>
          <dd>{huesped.preferencias || "—"}</dd>
        </div>
      </dl>

      <div className="divider" />

      <div className="card__header" style={{ marginBottom: 12 }}>
        <div>
          <h3 className="card__title">Historial de estadías</h3>
          <p className="card__subtitle">
            {reservas.length} {reservas.length === 1 ? "reserva" : "reservas"} · {estadias} estadías finalizadas · {totalNoches} noches
          </p>
        </div>
      </div>

      {historial.length === 0 ? (
        <EmptyState icon={History} title="Sin reservas" text="Este huésped todavía no tiene reservas registradas." />
      ) : (
        <TableView
          compact
          rows={historial}
          onRowClick={(r) => onOpenReserva(r.id)}
          rowTitle="Ver detalle de la reserva"
          columns={[
            { key: "id", label: "Reserva", className: "td-id", render: (r) => `#${r.id}` },
            { key: "hab", label: "Hab.", render: (r) => <Chip>{habitaciones[r.habitacion_id]?.numero ?? "—"}</Chip> },
            { key: "fechas", label: "Fechas", render: (r) => `${formatShortDate(r.fecha_checkin_prevista)} – ${formatShortDate(r.fecha_checkout_prevista)}` },
            { key: "monto", label: "Monto", className: "td-strong", render: (r) => formatMoney(r.precio_total) },
            { key: "estado", label: "Estado", render: (r) => <Badge color={RESERVA_ESTADOS[r.estado]?.color}>{RESERVA_ESTADOS[r.estado]?.label}</Badge> },
          ]}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Eliminar huésped"
          message={`Se eliminará el registro de ${fullName(huesped)}. Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          danger
          loading={deleting}
          onClose={() => setConfirmDelete(false)}
          onConfirm={remove}
        />
      )}
    </Drawer>
  );
}
