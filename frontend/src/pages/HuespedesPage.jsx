import { Eye, Pencil, Plus, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { habitacionesApi, huespedesApi, reservasApi } from "../api/services";
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
import { useToast } from "../context/ToastContext";
import HuespedFormModal from "../features/huespedes/HuespedFormModal";
import HuespedProfileDrawer from "../features/huespedes/HuespedProfileDrawer";
import ReservaDetailDrawer from "../features/reservas/ReservaDetailDrawer";
import { indexById, useApiData } from "../hooks/useApiData";
import { formatShortDate, nights } from "../utils/format";
import { fullName, guestStatus, isToday, matches } from "../utils/hotel";
import { COLORS, HUESPED_ESTADOS } from "../utils/status";

// Pestañas del mockup de Huéspedes.
const TABS = [
  { value: "todos", label: "Todos" },
  { value: "activo", label: "Activo" },
  { value: "checkin-hoy", label: "Check-in hoy" },
  { value: "confirmada", label: "Confirmada" },
  { value: "checkout", label: "Check-out" },
];

export default function HuespedesPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { data, loading, error, reload } = useApiData({
    huespedes: () => huespedesApi.list(),
    reservas: () => reservasApi.list(),
    habitaciones: () => habitacionesApi.list(),
  });
  const [tab, setTab] = useState("todos");
  const [query, setQuery] = useState("");
  const [profileId, setProfileId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [reservaId, setReservaId] = useState(null);
  const creating = params.get("accion") === "nuevo";

  const huespedesList = useMemo(() => data.huespedes ?? [], [data.huespedes]);
  const reservas = useMemo(() => data.reservas ?? [], [data.reservas]);
  const habitaciones = useMemo(() => indexById(data.habitaciones), [data.habitaciones]);
  const huespedesById = useMemo(() => indexById(huespedesList), [huespedesList]);

  const reservasPorHuesped = useMemo(() => {
    const map = {};
    reservas.forEach((r) => (map[r.huesped_id] ??= []).push(r));
    return map;
  }, [reservas]);

  const rows = useMemo(
    () =>
      huespedesList.map((h) => {
        const status = guestStatus(reservasPorHuesped[h.id]);
        return { ...h, status: status.key, reserva: status.reserva };
      }),
    [huespedesList, reservasPorHuesped],
  );

  const stats = useMemo(
    () => ({
      total: huespedesList.length,
      activos: rows.filter((r) => r.status === "activo").length,
      checkinHoy: reservas.filter((r) => isToday(r.fecha_checkin_prevista) && ["pendiente", "confirmada", "checkin"].includes(r.estado)).length,
      checkoutHoy: reservas.filter((r) => isToday(r.fecha_checkout_prevista) && ["checkin", "checkout"].includes(r.estado)).length,
    }),
    [huespedesList, rows, reservas],
  );

  const filtered = useMemo(
    () =>
      rows
        .filter((r) => tab === "todos" || r.status === tab)
        .filter((r) => matches(query, fullName(r), r.documento_identidad, r.email, r.telefono, r.nacionalidad))
        .sort((a, b) => fullName(a).localeCompare(fullName(b))),
    [rows, tab, query],
  );
  const { page, setPage, totalPages, pageItems } = usePagination(filtered, 10);

  function closeCreate() {
    const next = new URLSearchParams(params);
    next.delete("accion");
    setParams(next, { replace: true });
  }

  const columns = [
    { key: "huesped", label: "Huésped", render: (h) => <Person name={fullName(h)} size={30} /> },
    {
      key: "contacto",
      label: "Contacto",
      render: (h) => (
        <>
          <div style={{ fontSize: 11.5, color: "var(--gray-500)" }}>{h.email || "—"}</div>
          <div style={{ fontSize: 11.5, color: "var(--gray-400)" }}>{h.telefono || ""}</div>
        </>
      ),
    },
    { key: "hab", label: "Hab.", render: (h) => (h.reserva ? <Chip>{habitaciones[h.reserva.habitacion_id]?.numero ?? "—"}</Chip> : "—") },
    { key: "checkin", label: "Check-in", render: (h) => (h.reserva ? formatShortDate(h.reserva.fecha_checkin_prevista) : "—") },
    { key: "checkout", label: "Check-out", render: (h) => (h.reserva ? formatShortDate(h.reserva.fecha_checkout_prevista) : "—") },
    {
      key: "noches",
      label: "Noches",
      render: (h) => (h.reserva ? `${nights(h.reserva.fecha_checkin_prevista, h.reserva.fecha_checkout_prevista)}n` : "—"),
    },
    { key: "nac", label: "Nac.", render: (h) => <span style={{ fontSize: 12, color: "var(--gray-400)" }}>{h.nacionalidad || "—"}</span> },
    {
      key: "estado",
      label: "Estado",
      render: (h) => {
        const s = HUESPED_ESTADOS[h.status] ?? HUESPED_ESTADOS["sin-reservas"];
        return <Badge color={s.color}>{s.label}</Badge>;
      },
    },
    {
      key: "acciones",
      label: "Acciones",
      render: (h) => (
        <div className="icon-actions">
          <IconButton icon={Eye} title="Ver perfil" color={COLORS.purple} onClick={() => setProfileId(h.id)} />
          <IconButton icon={Pencil} title="Editar" color={COLORS.navy} onClick={() => setEditing(huespedesById[h.id])} />
        </div>
      ),
    },
  ];

  const profile = profileId && huespedesById[profileId];

  return (
    <>
      <StatGrid cols={4}>
        <MiniStat value={loading ? "—" : stats.total} label="Huéspedes registrados" color={COLORS.navy} />
        <MiniStat value={loading ? "—" : stats.activos} label="Activos hoy" color={COLORS.green} />
        <MiniStat value={loading ? "—" : stats.checkinHoy} label="Check-in hoy" color={COLORS.gold} />
        <MiniStat value={loading ? "—" : stats.checkoutHoy} label="Check-out hoy" color={COLORS.orange} />
      </StatGrid>

      <div className="toolbar">
        <Tabs options={TABS} value={tab} onChange={setTab} label="Filtrar por estado" />
        <SearchInput value={query} onChange={setQuery} placeholder="Buscar nombre, documento, correo..." />
        <div className="toolbar__end">
          <Button icon={Plus} onClick={() => setParams({ accion: "nuevo" }, { replace: true })}>
            Registrar huésped
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
            icon={Users}
            title={huespedesList.length ? "Sin resultados" : "Aún no hay huéspedes"}
            text={huespedesList.length ? "Ningún huésped coincide con el filtro o la búsqueda." : "Registra el primer huésped con el botón “Registrar huésped”."}
          />
        }
        footer={
          <>
            <span>
              Mostrando {pageItems.length} de {filtered.length} huéspedes
            </span>
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </>
        }
      />

      {(creating || editing) && (
        <HuespedFormModal
          huesped={editing}
          onClose={() => (editing ? setEditing(null) : closeCreate())}
          onSaved={(saved) => {
            toast.success(editing ? "Datos del huésped actualizados" : `Huésped ${saved.nombres} registrado`);
            if (editing) setEditing(null);
            else closeCreate();
            reload();
          }}
        />
      )}

      {profile && !editing && !reservaId && (
        <HuespedProfileDrawer
          huesped={profile}
          reservas={reservasPorHuesped[profile.id] ?? []}
          habitaciones={habitaciones}
          onClose={() => setProfileId(null)}
          onEdit={() => setEditing(profile)}
          onNewReserva={() => navigate(`/reservas?accion=nueva&huesped=${profile.id}`)}
          onOpenReserva={(id) => setReservaId(id)}
          onDeleted={() => {
            setProfileId(null);
            reload();
          }}
        />
      )}

      {reservaId && (
        <ReservaDetailDrawer
          reservaId={reservaId}
          huespedes={huespedesById}
          habitaciones={habitaciones}
          onClose={() => setReservaId(null)}
          onChanged={reload}
        />
      )}
    </>
  );
}
