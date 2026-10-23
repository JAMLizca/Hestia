import { CalendarDays, CheckCircle2, ClipboardCheck, Eye, LogIn, LogOut, Pencil, Plus, StickyNote, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { habitacionesApi, huespedesApi, reservasApi, tiposHabitacionApi } from "../api/services";
import {
  Badge,
  Button,
  Chip,
  DataTable,
  EmptyState,
  ErrorBanner,
  IconButton,
  MiniStat,
  Pagination,
  Person,
  SearchInput,
  StatGrid,
  Tabs,
  usePagination,
} from "../components/ui";
import { ConfirmDialog } from "../components/ui/Modal";
import { useToast } from "../context/ToastContext";
import ReservaDetailDrawer from "../features/reservas/ReservaDetailDrawer";
import ReservaEditModal from "../features/reservas/ReservaEditModal";
import ReservaFormModal from "../features/reservas/ReservaFormModal";
import { indexById, useApiData } from "../hooks/useApiData";
import { formatMoney, formatShortDate, nights } from "../utils/format";
import { ESTADOS_CANCELABLES, ESTADOS_EDITABLES, fullName, isToday, matches, nextStep, onlyDigits } from "../utils/hotel";
import { canalLabel, COLORS, PRECHECKIN_ESTADOS, RESERVA_ESTADOS } from "../utils/status";

const TABS = [
  { value: "todas", label: "Todas" },
  { value: "confirmada", label: "Confirmada" },
  { value: "checkin", label: "Check-in" },
  { value: "pendiente", label: "Pendiente" },
  { value: "checkout", label: "Check-out" },
  { value: "cancelada", label: "Canceladas" },
  { value: "no_show", label: "No se presentó" },
];

const STEP_ICONS = { confirmar: CheckCircle2, checkin: LogIn, checkout: LogOut };
const STEP_MESSAGES = { confirmar: "Reserva confirmada", checkin: "Check-in registrado", checkout: "Check-out registrado" };

export default function ReservasPage() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const { data, loading, error, reload } = useApiData({
    reservas: () => reservasApi.list(),
    huespedes: () => huespedesApi.list(),
    habitaciones: () => habitacionesApi.list(),
    tipos: () => tiposHabitacionApi.list(),
  });
  const [tab, setTab] = useState("todas");
  const [query, setQuery] = useState("");
  const [detailId, setDetailId] = useState(() => Number(params.get("reserva")) || null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [busy, setBusy] = useState(null);
  const showForm = params.get("accion") === "nueva";

  const reservas = useMemo(() => data.reservas ?? [], [data.reservas]);
  const huespedes = useMemo(() => indexById(data.huespedes), [data.huespedes]);
  const habitaciones = useMemo(() => indexById(data.habitaciones), [data.habitaciones]);

  const stats = useMemo(
    () => ({
      total: reservas.length,
      confirmadas: reservas.filter((r) => r.estado === "confirmada").length,
      pendientes: reservas.filter((r) => r.estado === "pendiente").length,
      checkinHoy: reservas.filter((r) => isToday(r.fecha_checkin_prevista) && !["cancelada", "no_show"].includes(r.estado)).length,
    }),
    [reservas],
  );

  const filtered = useMemo(
    () =>
      reservas
        .filter((r) => tab === "todas" || r.estado === tab)
        .filter((r) => {
          const huesped = huespedes[r.huesped_id];
          const digits = onlyDigits(query);
          return (
            matches(query, fullName(huesped), huesped?.documento_identidad, huesped?.telefono, habitaciones[r.habitacion_id]?.numero, `#${r.id}`, r.id, r.codigo) ||
            (digits.length >= 4 && onlyDigits(huesped?.telefono).includes(digits))
          );
        })
        .sort((a, b) => b.id - a.id),
    [reservas, tab, query, huespedes, habitaciones],
  );
  const { page, setPage, totalPages, pageItems } = usePagination(filtered, 10);

  function setFormOpen(open) {
    const next = new URLSearchParams(params);
    if (open) next.set("accion", "nueva");
    else {
      next.delete("accion");
      next.delete("huesped");
    }
    setParams(next, { replace: true });
  }

  async function advance(reserva) {
    const step = nextStep(reserva.estado);
    setBusy(reserva.id);
    try {
      await reservasApi[step.action](reserva.id);
      toast.success(`${STEP_MESSAGES[step.action]} · Reserva ${reserva.codigo}`);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  }

  async function cancel() {
    setBusy(cancelTarget.id);
    try {
      await reservasApi.cancelar(cancelTarget.id);
      toast.success(`Reserva ${cancelTarget.codigo} cancelada`);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
      setCancelTarget(null);
    }
  }

  const columns = [
    {
      key: "codigo",
      label: "Código",
      className: "td-id",
      render: (r) => (
        <>
          <span className="reserva-code">{r.codigo}</span>
          {r.notas && <StickyNote size={12} strokeWidth={1.75} className="reserva-code__note" aria-label="Tiene notas" title={r.notas} />}
          {["completado", "validado"].includes(r.precheckin_estado) && (
            <ClipboardCheck
              size={12}
              strokeWidth={1.75}
              className="reserva-code__note"
              style={{ color: PRECHECKIN_ESTADOS[r.precheckin_estado].color }}
              aria-label={`Pre-check-in: ${PRECHECKIN_ESTADOS[r.precheckin_estado].label}`}
              title={`Pre-check-in: ${PRECHECKIN_ESTADOS[r.precheckin_estado].label}`}
            />
          )}
          <span className="reserva-canal">{canalLabel(r.canal)}</span>
        </>
      ),
    },
    { key: "huesped", label: "Huésped", primary: true, render: (r) => <Person name={fullName(huespedes[r.huesped_id])} /> },
    { key: "habitacion", label: "Habitación", render: (r) => <Chip>{habitaciones[r.habitacion_id]?.numero ?? "—"}</Chip> },
    { key: "checkin", label: "Check-in", render: (r) => formatShortDate(r.fecha_checkin_prevista) },
    { key: "checkout", label: "Check-out", render: (r) => formatShortDate(r.fecha_checkout_prevista) },
    { key: "noches", label: "Noches", render: (r) => `${nights(r.fecha_checkin_prevista, r.fecha_checkout_prevista)}n` },
    { key: "monto", label: "Monto", className: "td-strong", render: (r) => formatMoney(r.precio_total) },
    {
      key: "estado",
      label: "Estado",
      render: (r) => <Badge color={RESERVA_ESTADOS[r.estado]?.color}>{RESERVA_ESTADOS[r.estado]?.label ?? r.estado}</Badge>,
    },
    {
      key: "acciones",
      label: "Acciones",
      render: (r) => {
        const step = nextStep(r.estado);
        return (
          <div className="icon-actions">
            <IconButton icon={Eye} title="Ver detalle" color={COLORS.purple} onClick={() => setDetailId(r.id)} />
            <IconButton
              icon={Pencil}
              title="Editar reserva"
              color={COLORS.gold}
              disabled={!ESTADOS_EDITABLES.includes(r.estado) || busy === r.id}
              onClick={() => setEditTarget(r)}
            />
            <IconButton
              icon={step ? STEP_ICONS[step.action] : CheckCircle2}
              title={step ? step.label : "Sin acciones pendientes"}
              color={COLORS.navy}
              disabled={!step || busy === r.id}
              onClick={() => advance(r)}
            />
            <IconButton
              icon={Trash2}
              title="Cancelar"
              color={COLORS.red}
              disabled={!ESTADOS_CANCELABLES.includes(r.estado) || busy === r.id}
              onClick={() => setCancelTarget(r)}
            />
          </div>
        );
      },
    },
  ];

  return (
    <>
      <StatGrid cols={4}>
        <MiniStat value={loading ? "—" : stats.total} label="Total reservas" color={COLORS.navy} />
        <MiniStat value={loading ? "—" : stats.confirmadas} label="Confirmadas" color={COLORS.green} />
        <MiniStat value={loading ? "—" : stats.pendientes} label="Pendientes" color={COLORS.orange} />
        <MiniStat value={loading ? "—" : stats.checkinHoy} label="Check-in hoy" color={COLORS.gold} />
      </StatGrid>

      <div className="toolbar">
        <Tabs options={TABS} value={tab} onChange={setTab} label="Filtrar por estado" />
        <SearchInput value={query} onChange={setQuery} placeholder="Huésped, teléfono, código…" />
        <div className="toolbar__end">
          <Button icon={Plus} onClick={() => setFormOpen(true)} disabled={loading}>
            Nueva reserva
          </Button>
        </div>
      </div>

      <ErrorBanner message={error} onRetry={reload} />

      <DataTable
        columns={columns}
        rows={pageItems}
        loading={loading}
        empty={
          <EmptyState
            icon={CalendarDays}
            title={reservas.length ? "Sin resultados" : "Aún no hay reservas"}
            text={reservas.length ? "Ninguna reserva coincide con el filtro o la búsqueda." : "Crea la primera reserva con el botón “Nueva reserva”."}
          />
        }
        footer={
          <>
            <span>
              Mostrando {pageItems.length} de {filtered.length} reservas
            </span>
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </>
        }
      />

      {showForm && !loading && (
        <ReservaFormModal
          huespedes={data.huespedes ?? []}
          tipos={data.tipos ?? []}
          initialHuespedId={params.get("huesped")}
          onClose={() => setFormOpen(false)}
          onGuestCreated={reload}
          onCreated={(reserva) => {
            toast.success(`Reserva ${reserva.codigo} creada en estado pendiente`);
            setFormOpen(false);
            reload();
            setDetailId(reserva.id);
          }}
        />
      )}

      {detailId && (
        <ReservaDetailDrawer
          reservaId={detailId}
          huespedes={huespedes}
          habitaciones={habitaciones}
          onClose={() => setDetailId(null)}
          onChanged={reload}
        />
      )}

      {editTarget && (
        <ReservaEditModal
          reserva={editTarget}
          huesped={huespedes[editTarget.huesped_id]}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            toast.success(`Reserva ${editTarget.codigo} actualizada`);
            setEditTarget(null);
            reload();
          }}
        />
      )}

      {cancelTarget && (
        <ConfirmDialog
          title="Cancelar reserva"
          message={`La reserva ${cancelTarget.codigo} de ${fullName(huespedes[cancelTarget.huesped_id])} pasará a estado cancelada.`}
          confirmLabel="Cancelar reserva"
          danger
          loading={busy === cancelTarget.id}
          onClose={() => setCancelTarget(null)}
          onConfirm={cancel}
        />
      )}
    </>
  );
}
