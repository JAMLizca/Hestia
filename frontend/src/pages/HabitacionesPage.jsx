import { BedDouble, LayoutGrid, Layers, List, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { habitacionesApi, tiposHabitacionApi } from "../api/services";
import {
  Badge,
  Button,
  Chip,
  DataTable,
  EmptyState,
  ErrorBanner,
  IconButton,
  LoadingState,
  MiniStat,
  Pagination,
  SearchInput,
  StatGrid,
  Tabs,
  usePagination,
} from "../components/ui";
import { ConfirmDialog } from "../components/ui/Modal";
import { useToast } from "../context/ToastContext";
import HabitacionFormModal from "../features/habitaciones/HabitacionFormModal";
import RoomCard from "../features/habitaciones/RoomCard";
import TipoHabitacionFormModal from "../features/habitaciones/TipoHabitacionFormModal";
import { indexById, useApiData } from "../hooks/useApiData";
import { formatMoney } from "../utils/format";
import { matches } from "../utils/hotel";
import { COLORS, HABITACION_ESTADOS } from "../utils/status";

const VIEWS = [
  { value: "habitaciones", label: "Habitaciones" },
  { value: "tipos", label: "Tipos de habitación" },
];

export default function HabitacionesPage() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const { data, loading, error, reload } = useApiData({
    habitaciones: () => habitacionesApi.list(),
    tipos: () => tiposHabitacionApi.list(),
  });
  const [view, setView] = useState("habitaciones");
  const [layout, setLayout] = useState("tarjetas");
  const [estado, setEstado] = useState("todas");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [tipoForm, setTipoForm] = useState(null); // null | "nuevo" | tipo
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busy, setBusy] = useState(null);
  const creating = params.get("accion") === "nueva";

  const habitaciones = useMemo(() => data.habitaciones ?? [], [data.habitaciones]);
  const tipos = useMemo(() => data.tipos ?? [], [data.tipos]);
  const tiposById = useMemo(() => indexById(tipos), [tipos]);

  const counts = useMemo(() => {
    const c = { total: habitaciones.length };
    Object.keys(HABITACION_ESTADOS).forEach((k) => (c[k] = habitaciones.filter((h) => h.estado === k).length));
    return c;
  }, [habitaciones]);

  const estadoTabs = [
    { value: "todas", label: "Todas" },
    ...Object.entries(HABITACION_ESTADOS).map(([value, s]) => ({ value, label: s.label })),
  ];

  const filtered = useMemo(
    () =>
      habitaciones
        .filter((h) => estado === "todas" || h.estado === estado)
        .filter((h) => matches(query, h.numero, tiposById[h.tipo_habitacion_id]?.nombre, h.caracteristicas, h.piso))
        .sort((a, b) => String(a.numero).localeCompare(String(b.numero), "es", { numeric: true })),
    [habitaciones, estado, query, tiposById],
  );
  const { page, setPage, totalPages, pageItems } = usePagination(filtered, layout === "tarjetas" ? 12 : 10);

  function closeCreate() {
    const next = new URLSearchParams(params);
    next.delete("accion");
    setParams(next, { replace: true });
  }

  // Housekeeping: tras el check-out el backend deja la habitación en "limpieza".
  async function markAvailable(h) {
    setBusy(h.id);
    try {
      await habitacionesApi.update(h.id, { estado: "disponible" });
      toast.success(`Habitación ${h.numero} marcada como disponible`);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  }

  async function confirmDelete() {
    const { kind, item } = deleteTarget;
    setBusy(`del-${item.id}`);
    try {
      if (kind === "tipo") await tiposHabitacionApi.remove(item.id);
      else await habitacionesApi.remove(item.id);
      toast.success(kind === "tipo" ? `Tipo “${item.nombre}” eliminado` : `Habitación ${item.numero} eliminada`);
      reload();
    } catch (err) {
      // DELETE /habitaciones/{id} responde 422 por un error en la ruta del backend
      // (declarada como {habitacion_idz}). Se informa en lugar de mostrar el detalle técnico.
      toast.error(
        kind === "habitacion" && err.status === 422
          ? "El backend no permite eliminar habitaciones todavía (error en la ruta DELETE /habitaciones). Reportado al equipo de backend."
          : err.message,
      );
    } finally {
      setBusy(null);
      setDeleteTarget(null);
    }
  }

  const habitacionColumns = [
    { key: "numero", label: "Número", render: (h) => <Chip>{h.numero}</Chip> },
    { key: "tipo", label: "Tipo", render: (h) => <span style={{ color: "var(--navy-900)", fontWeight: 500 }}>{tiposById[h.tipo_habitacion_id]?.nombre ?? "—"}</span> },
    { key: "piso", label: "Piso", render: (h) => h.piso ?? "—" },
    { key: "capacidad", label: "Capacidad", render: (h) => (tiposById[h.tipo_habitacion_id] ? `${tiposById[h.tipo_habitacion_id].capacidad_maxima} pers.` : "—") },
    { key: "precio", label: "Precio / noche", className: "td-strong", render: (h) => formatMoney(tiposById[h.tipo_habitacion_id]?.precio_base) },
    {
      key: "estado",
      label: "Estado",
      render: (h) => <Badge color={HABITACION_ESTADOS[h.estado]?.color}>{HABITACION_ESTADOS[h.estado]?.label ?? h.estado}</Badge>,
    },
    { key: "caracteristicas", label: "Características", className: "td-wrap", render: (h) => h.caracteristicas || "—" },
    {
      key: "acciones",
      label: "Acciones",
      render: (h) => (
        <div className="icon-actions">
          <IconButton
            icon={Sparkles}
            title={h.estado === "limpieza" ? "Marcar como disponible (limpieza terminada)" : "Solo aplica a habitaciones en limpieza"}
            color={COLORS.green}
            disabled={h.estado !== "limpieza" || busy === h.id}
            onClick={() => markAvailable(h)}
          />
          <IconButton icon={Pencil} title="Editar" color={COLORS.navy} onClick={() => setEditing(h)} />
          <IconButton icon={Trash2} title="Eliminar" color={COLORS.red} onClick={() => setDeleteTarget({ kind: "habitacion", item: h })} />
        </div>
      ),
    },
  ];

  const tipoColumns = [
    { key: "nombre", label: "Nombre", render: (t) => <span style={{ color: "var(--navy-900)", fontWeight: 500 }}>{t.nombre}</span> },
    { key: "descripcion", label: "Descripción", className: "td-wrap", render: (t) => t.descripcion || "—" },
    { key: "capacidad", label: "Capacidad", render: (t) => `${t.capacidad_maxima} pers.` },
    { key: "camas", label: "Camas", render: (t) => t.camas },
    { key: "m2", label: "m²", render: (t) => (t.metros_cuadrados != null ? Number(t.metros_cuadrados) : "—") },
    { key: "precio", label: "Precio base", className: "td-strong", render: (t) => formatMoney(t.precio_base) },
    { key: "habitaciones", label: "Habitaciones", render: (t) => habitaciones.filter((h) => h.tipo_habitacion_id === t.id).length },
    {
      key: "acciones",
      label: "Acciones",
      render: (t) => (
        <div className="icon-actions">
          <IconButton icon={Pencil} title="Editar" color={COLORS.navy} onClick={() => setTipoForm(t)} />
          <IconButton icon={Trash2} title="Eliminar" color={COLORS.red} onClick={() => setDeleteTarget({ kind: "tipo", item: t })} />
        </div>
      ),
    },
  ];

  const emptyRooms = (
    <EmptyState
      icon={BedDouble}
      title={habitaciones.length ? "Sin resultados" : "Aún no hay habitaciones"}
      text={habitaciones.length ? "Ninguna habitación coincide con el filtro o la búsqueda." : "Crea la primera habitación con el botón “Nueva habitación”."}
    />
  );
  const roomsFooter = (
    <>
      <span>
        Mostrando {pageItems.length} de {filtered.length} habitaciones
      </span>
      <Pagination page={page} totalPages={totalPages} onChange={setPage} />
    </>
  );

  return (
    <>
      <StatGrid cols={5}>
        <MiniStat value={loading ? "—" : counts.total} label="Habitaciones" color={COLORS.navy} />
        <MiniStat value={loading ? "—" : counts.disponible} label="Disponibles" color={COLORS.green} />
        <MiniStat value={loading ? "—" : counts.ocupada} label="Ocupadas" color={COLORS.navy} />
        <MiniStat value={loading ? "—" : counts.limpieza} label="En limpieza" color={COLORS.gold} />
        <MiniStat value={loading ? "—" : counts.mantenimiento} label="Mantenimiento" color={COLORS.orange} />
      </StatGrid>

      <div className="toolbar">
        <Tabs options={VIEWS} value={view} onChange={setView} label="Sección" />
        <div className="toolbar__end">
          {view === "habitaciones" ? (
            <Button icon={Plus} onClick={() => setParams({ accion: "nueva" }, { replace: true })} disabled={loading}>
              Nueva habitación
            </Button>
          ) : (
            <Button icon={Plus} onClick={() => setTipoForm("nuevo")}>
              Nuevo tipo
            </Button>
          )}
        </div>
      </div>

      <ErrorBanner message={error} onRetry={reload} />

      {view === "habitaciones" ? (
        <>
          <div className="toolbar">
            <Tabs options={estadoTabs} value={estado} onChange={setEstado} label="Filtrar por estado" />
            <SearchInput value={query} onChange={setQuery} placeholder="Buscar número, tipo o característica..." />
            <div className="toolbar__end">
              <Tabs
                label="Vista"
                value={layout}
                onChange={setLayout}
                options={[
                  { value: "tarjetas", label: <span className="tab-icon"><LayoutGrid size={13} /> Tarjetas</span> },
                  { value: "tabla", label: <span className="tab-icon"><List size={13} /> Tabla</span> },
                ]}
              />
            </div>
          </div>
          {layout === "tabla" ? (
            <DataTable
              columns={habitacionColumns}
              rows={pageItems}
              loading={loading}
              empty={emptyRooms}
              footer={roomsFooter}
            />
          ) : loading ? (
            <LoadingState />
          ) : pageItems.length === 0 ? (
            <div className="card">{emptyRooms}</div>
          ) : (
            <>
              <div className="room-grid">
                {pageItems.map((h) => (
                  <RoomCard
                    key={h.id}
                    habitacion={h}
                    tipo={tiposById[h.tipo_habitacion_id]}
                    busy={busy === h.id}
                    onEdit={() => setEditing(h)}
                    onDelete={() => setDeleteTarget({ kind: "habitacion", item: h })}
                    onMarkAvailable={() => markAvailable(h)}
                  />
                ))}
              </div>
              <div className="card table-footer">{roomsFooter}</div>
            </>
          )}
        </>
      ) : (
        <DataTable
          columns={tipoColumns}
          rows={tipos}
          loading={loading}
          empty={<EmptyState icon={Layers} title="Aún no hay tipos de habitación" text="Crea un tipo (por ejemplo, Estándar o Suite) para poder registrar habitaciones." />}
          footer={<span>{tipos.length} tipos de habitación</span>}
        />
      )}

      {(creating || editing) && !loading && (
        <HabitacionFormModal
          habitacion={editing}
          tipos={tipos}
          onClose={() => (editing ? setEditing(null) : closeCreate())}
          onSaved={(saved) => {
            toast.success(editing ? `Habitación ${saved.numero} actualizada` : `Habitación ${saved.numero} creada`);
            if (editing) setEditing(null);
            else closeCreate();
            reload();
          }}
        />
      )}

      {tipoForm && (
        <TipoHabitacionFormModal
          tipo={tipoForm === "nuevo" ? null : tipoForm}
          onClose={() => setTipoForm(null)}
          onSaved={(saved) => {
            toast.success(tipoForm === "nuevo" ? `Tipo “${saved.nombre}” creado` : `Tipo “${saved.nombre}” actualizado`);
            setTipoForm(null);
            reload();
          }}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title={deleteTarget.kind === "tipo" ? "Eliminar tipo de habitación" : "Eliminar habitación"}
          message={
            deleteTarget.kind === "tipo"
              ? `Se eliminará el tipo “${deleteTarget.item.nombre}”. El backend no lo permite si tiene habitaciones asociadas.`
              : `Se eliminará la habitación ${deleteTarget.item.numero}.`
          }
          confirmLabel="Eliminar"
          danger
          loading={busy === `del-${deleteTarget.item.id}`}
          onClose={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}
    </>
  );
}
