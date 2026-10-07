import { ConciergeBell, Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { habitacionesApi, huespedesApi, reservaServiciosApi, reservasApi, serviciosApi } from "../api/services";
import {
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
import ConsumoFormModal from "../features/servicios/ConsumoFormModal";
import ServicioFormModal from "../features/servicios/ServicioFormModal";
import { indexById, useApiData } from "../hooks/useApiData";
import { formatMoney, parseDate } from "../utils/format";
import { ESTADOS_MODIFICABLES, fullName, isToday, matches } from "../utils/hotel";
import { categoriaColor, COLORS } from "../utils/status";

const VIEWS = [
  { value: "consumos", label: "Consumos" },
  { value: "catalogo", label: "Catálogo" },
];
const CONSUMO_TABS = [
  { value: "todos", label: "Todos" },
  { value: "activas", label: "Reservas activas" },
  { value: "finalizadas", label: "Reservas finalizadas" },
];

/**
 * El backend no tiene un endpoint global de consumos: se piden por reserva
 * (GET /reservas/{id}/servicios/) para todas las reservas no canceladas.
 */
async function loadConsumos() {
  const reservas = await reservasApi.list();
  const conConsumos = reservas.filter((r) => r.estado !== "cancelada");
  const listas = await Promise.all(conConsumos.map((r) => reservaServiciosApi.list(r.id)));
  return { reservas, consumos: listas.flat() };
}

function formatConsumoDate(value) {
  const date = parseDate(value);
  if (!date) return "—";
  const time = date.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: false });
  return isToday(value) ? time : `${date.toLocaleDateString("es-CO", { day: "2-digit", month: "short" })} · ${time}`;
}

export default function ServiciosPage() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const { data, loading, error, reload } = useApiData({
    servicios: () => serviciosApi.list(),
    consumos: loadConsumos,
    huespedes: () => huespedesApi.list(),
    habitaciones: () => habitacionesApi.list(),
  });
  const [view, setView] = useState("consumos");
  const [tab, setTab] = useState("todos");
  const [query, setQuery] = useState("");
  const [servicioForm, setServicioForm] = useState(null); // null | "nuevo" | servicio
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busy, setBusy] = useState(null);
  const [reservaId, setReservaId] = useState(null);
  const consumoOpen = params.get("accion") === "consumo";

  const catalogo = useMemo(() => data.servicios ?? [], [data.servicios]);
  const reservas = useMemo(() => data.consumos?.reservas ?? [], [data.consumos]);
  const consumos = useMemo(() => data.consumos?.consumos ?? [], [data.consumos]);
  const catalogoById = useMemo(() => indexById(catalogo), [catalogo]);
  const reservasById = useMemo(() => indexById(reservas), [reservas]);
  const huespedes = useMemo(() => indexById(data.huespedes), [data.huespedes]);
  const habitaciones = useMemo(() => indexById(data.habitaciones), [data.habitaciones]);

  const rows = useMemo(
    () =>
      consumos.map((c) => {
        const reserva = reservasById[c.reserva_id];
        return {
          ...c,
          reserva,
          servicio: catalogoById[c.servicio_id],
          huesped: reserva && huespedes[reserva.huesped_id],
          habitacion: reserva && habitaciones[reserva.habitacion_id],
          activa: reserva && ESTADOS_MODIFICABLES.includes(reserva.estado),
        };
      }),
    [consumos, reservasById, catalogoById, huespedes, habitaciones],
  );

  const stats = useMemo(() => {
    const hoy = rows.filter((r) => isToday(r.fecha_consumo));
    return {
      hoy: hoy.length,
      ingresosHoy: hoy.reduce((acc, r) => acc + Number(r.subtotal), 0),
      activos: rows.filter((r) => r.activa).length,
      catalogo: catalogo.length,
    };
  }, [rows, catalogo]);

  const filtered = useMemo(
    () =>
      rows
        .filter((r) => tab === "todos" || (tab === "activas" ? r.activa : !r.activa))
        .filter((r) => matches(query, r.servicio?.nombre, r.servicio?.categoria, fullName(r.huesped), r.habitacion?.numero, `SV-${r.id}`, `#${r.reserva_id}`))
        .sort((a, b) => (parseDate(b.fecha_consumo) ?? 0) - (parseDate(a.fecha_consumo) ?? 0)),
    [rows, tab, query],
  );
  const { page, setPage, totalPages, pageItems } = usePagination(filtered, 10);

  const catalogoFiltrado = useMemo(
    () => catalogo.filter((s) => matches(query, s.nombre, s.categoria, s.descripcion)).sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [catalogo, query],
  );

  function setConsumoOpen(open) {
    const next = new URLSearchParams(params);
    if (open) next.set("accion", "consumo");
    else next.delete("accion");
    setParams(next, { replace: true });
  }

  async function confirmDelete() {
    const { kind, item } = deleteTarget;
    setBusy(`${kind}-${item.id}`);
    try {
      if (kind === "consumo") await reservaServiciosApi.remove(item.reserva_id, item.id);
      else await serviciosApi.remove(item.id);
      toast.success(kind === "consumo" ? "Consumo eliminado de la reserva" : `Servicio “${item.nombre}” eliminado del catálogo`);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
      setDeleteTarget(null);
    }
  }

  const consumoColumns = [
    { key: "id", label: "ID", className: "td-id", render: (c) => `SV-${String(c.id).padStart(3, "0")}` },
    { key: "servicio", label: "Servicio", primary: true, render: (c) => <span style={{ fontSize: 13, fontWeight: 500, color: "var(--navy-900)" }}>{c.servicio?.nombre ?? `Servicio #${c.servicio_id}`}</span> },
    { key: "categoria", label: "Categoría", render: (c) => (c.servicio?.categoria ? <Chip color={categoriaColor(c.servicio.categoria)}>{c.servicio.categoria}</Chip> : "—") },
    { key: "habitacion", label: "Habitación", render: (c) => <Chip>{c.habitacion?.numero ?? "—"}</Chip> },
    { key: "huesped", label: "Huésped", render: (c) => <Person name={fullName(c.huesped)} size={24} muted /> },
    { key: "fecha", label: "Solicitado", render: (c) => formatConsumoDate(c.fecha_consumo) },
    { key: "cantidad", label: "Cant.", render: (c) => c.cantidad },
    { key: "subtotal", label: "Subtotal", className: "td-strong", render: (c) => formatMoney(c.subtotal) },
    {
      key: "acciones",
      label: "Acciones",
      render: (c) => (
        <div className="icon-actions">
          <IconButton icon={Eye} title={`Ver reserva #${c.reserva_id}`} color={COLORS.purple} onClick={() => setReservaId(c.reserva_id)} />
          <IconButton
            icon={Trash2}
            title={c.activa ? "Eliminar consumo" : "La reserva ya no admite cambios"}
            color={COLORS.red}
            disabled={!c.activa}
            onClick={() => setDeleteTarget({ kind: "consumo", item: c })}
          />
        </div>
      ),
    },
  ];

  const catalogoColumns = [
    { key: "nombre", label: "Servicio", render: (s) => <span style={{ fontSize: 13, fontWeight: 500, color: "var(--navy-900)" }}>{s.nombre}</span> },
    { key: "categoria", label: "Categoría", render: (s) => (s.categoria ? <Chip color={categoriaColor(s.categoria)}>{s.categoria}</Chip> : "—") },
    { key: "descripcion", label: "Descripción", className: "td-wrap", render: (s) => s.descripcion || "—" },
    { key: "precio", label: "Precio", className: "td-strong", render: (s) => formatMoney(s.precio) },
    { key: "usos", label: "Consumos", render: (s) => rows.filter((r) => r.servicio_id === s.id).length },
    {
      key: "acciones",
      label: "Acciones",
      render: (s) => (
        <div className="icon-actions">
          <IconButton icon={Pencil} title="Editar" color={COLORS.navy} onClick={() => setServicioForm(s)} />
          <IconButton icon={Trash2} title="Eliminar" color={COLORS.red} onClick={() => setDeleteTarget({ kind: "servicio", item: s })} />
        </div>
      ),
    },
  ];

  return (
    <>
      <StatGrid cols={4}>
        <MiniStat value={loading ? "—" : stats.hoy} label="Consumos hoy" color={COLORS.navy} />
        <MiniStat value={loading ? "—" : formatMoney(stats.ingresosHoy)} label="Ingresos por servicios hoy" color={COLORS.green} />
        <MiniStat value={loading ? "—" : stats.activos} label="En reservas activas" color={COLORS.purple} />
        <MiniStat value={loading ? "—" : stats.catalogo} label="Servicios en catálogo" color={COLORS.gold} />
      </StatGrid>

      <div className="toolbar">
        <Tabs options={VIEWS} value={view} onChange={setView} label="Sección" />
        <div className="toolbar__end">
          {view === "consumos" ? (
            <Button icon={Plus} onClick={() => setConsumoOpen(true)} disabled={loading}>
              Registrar consumo
            </Button>
          ) : (
            <Button icon={Plus} onClick={() => setServicioForm("nuevo")}>
              Nuevo servicio
            </Button>
          )}
        </div>
      </div>

      <ErrorBanner message={error} onRetry={reload} />

      <div className="toolbar">
        {view === "consumos" && <Tabs options={CONSUMO_TABS} value={tab} onChange={setTab} label="Filtrar consumos" />}
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder={view === "consumos" ? "Buscar servicio, huésped, habitación..." : "Buscar en el catálogo..."}
        />
      </div>

      {view === "consumos" ? (
        <DataTable
          columns={consumoColumns}
          rows={pageItems}
          loading={loading}
          empty={
            <EmptyState
              icon={ConciergeBell}
              title={consumos.length ? "Sin resultados" : "Aún no hay consumos"}
              text={consumos.length ? "Ningún consumo coincide con el filtro o la búsqueda." : "Registra el primer consumo con el botón “Registrar consumo”."}
            />
          }
          footer={
            <>
              <span>
                {pageItems.length} de {filtered.length} servicios
              </span>
              <Pagination page={page} totalPages={totalPages} onChange={setPage} />
            </>
          }
        />
      ) : (
        <DataTable
          columns={catalogoColumns}
          rows={catalogoFiltrado}
          loading={loading}
          empty={<EmptyState icon={ConciergeBell} title="Catálogo vacío" text="Crea el primer servicio (desayuno, lavandería, traslados…)." />}
          footer={<span>{catalogoFiltrado.length} servicios en el catálogo</span>}
        />
      )}

      {consumoOpen && !loading && (
        <ConsumoFormModal
          reservas={reservas}
          catalogo={catalogo}
          huespedes={huespedes}
          habitaciones={habitaciones}
          onClose={() => setConsumoOpen(false)}
          onSaved={() => {
            toast.success("Consumo registrado en la reserva");
            setConsumoOpen(false);
            reload();
          }}
        />
      )}

      {servicioForm && (
        <ServicioFormModal
          servicio={servicioForm === "nuevo" ? null : servicioForm}
          onClose={() => setServicioForm(null)}
          onSaved={(saved) => {
            toast.success(servicioForm === "nuevo" ? `Servicio “${saved.nombre}” creado` : `Servicio “${saved.nombre}” actualizado`);
            setServicioForm(null);
            reload();
          }}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title={deleteTarget.kind === "consumo" ? "Eliminar consumo" : "Eliminar servicio"}
          message={
            deleteTarget.kind === "consumo"
              ? `Se quitará “${deleteTarget.item.servicio?.nombre}” de la reserva #${deleteTarget.item.reserva_id}.`
              : `Se eliminará “${deleteTarget.item.nombre}” del catálogo. El backend no lo permite si ya fue consumido en alguna reserva.`
          }
          confirmLabel="Eliminar"
          danger
          loading={busy === `${deleteTarget.kind}-${deleteTarget.item.id}`}
          onClose={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}

      {reservaId && (
        <ReservaDetailDrawer
          reservaId={reservaId}
          huespedes={huespedes}
          habitaciones={habitaciones}
          onClose={() => setReservaId(null)}
          onChanged={reload}
        />
      )}
    </>
  );
}
