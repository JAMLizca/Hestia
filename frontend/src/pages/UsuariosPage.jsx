import { KeyRound, Lock, Pencil, Plus, Power, PowerOff, Trash2, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { rolesApi, usuariosApi } from "../api/services";
import {
  Badge,
  Button,
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
import { useAuth } from "../context/AuthContext";
import { usePermisos } from "../context/PermisosContext";
import { useToast } from "../context/ToastContext";
import { PasswordModal, UsuarioFormModal } from "../features/usuarios/UsuarioFormModal";
import { indexById, useApiData } from "../hooks/useApiData";
import { capitalize } from "../utils/format";
import { matches } from "../utils/hotel";
import { COLORS } from "../utils/status";

const TABS = [
  { value: "todos", label: "Todos" },
  { value: "activos", label: "Activos" },
  { value: "inactivos", label: "Inactivos" },
];

const ROL_COLORS = { administrador: COLORS.purple, gerente: COLORS.gold, recepcionista: COLORS.cyan, auditor: COLORS.green };

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" }).replace(/\./g, "").replace(/ de /g, " ");
}

/**
 * Administración de usuarios. Los endpoints de /usuarios son solo para el rol
 * administrador; el resto del personal ve un aviso en lugar de un error 403.
 * (La autorización real la hace el backend: esto solo mejora la experiencia.)
 */
export default function UsuariosPage() {
  const { can } = usePermisos();
  if (!can("usuarios", "ver")) {
    return (
      <EmptyState
        icon={Lock}
        title="Solo para administradores"
        text="La gestión de usuarios está reservada al rol administrador. Si necesitas una cuenta nueva o un cambio de rol, solicítalo a un administrador."
      />
    );
  }
  return <UsuariosAdmin />;
}

function UsuariosAdmin() {
  const { user: yo } = useAuth();
  const { can } = usePermisos();
  const toast = useToast();
  const { data, loading, error, reload } = useApiData({
    usuarios: () => usuariosApi.list(),
    roles: () => rolesApi.list(),
  });
  const [tab, setTab] = useState("todos");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [passwordFor, setPasswordFor] = useState(null);
  const [toggling, setToggling] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);

  const usuarios = useMemo(() => data.usuarios ?? [], [data.usuarios]);
  const roles = useMemo(() => data.roles ?? [], [data.roles]);
  const rolesById = useMemo(() => indexById(roles), [roles]);
  const rolNombre = (u) => rolesById[u.rol_id]?.nombre ?? "—";

  const stats = useMemo(
    () => ({
      total: usuarios.length,
      activos: usuarios.filter((u) => u.activo).length,
      inactivos: usuarios.filter((u) => !u.activo).length,
      admins: usuarios.filter((u) => rolesById[u.rol_id]?.nombre === "administrador").length,
    }),
    [usuarios, rolesById],
  );

  const filtered = useMemo(
    () =>
      usuarios
        .filter((u) => tab === "todos" || (tab === "activos" ? u.activo : !u.activo))
        .filter((u) => matches(query, u.nombre, u.email, rolNombre(u))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [usuarios, tab, query, rolesById],
  );
  const { page, setPage, totalPages, pageItems } = usePagination(filtered, 10);

  async function confirmToggle() {
    setBusy(true);
    try {
      await usuariosApi.update(toggling.id, { activo: !toggling.activo });
      toast.success(toggling.activo ? `${toggling.nombre} fue desactivado` : `${toggling.nombre} fue activado`);
      setToggling(null);
      reload();
    } catch (err) {
      toast.error(err.message);
      setToggling(null);
    } finally {
      setBusy(false);
    }
  }

  async function confirmRemove() {
    setBusy(true);
    try {
      await usuariosApi.remove(removing.id);
      toast.success(`${removing.nombre} fue eliminado`);
      setRemoving(null);
      reload();
    } catch (err) {
      // 409: ya tiene historial (reservas o validaciones); el mensaje del servidor sugiere desactivarlo.
      toast.error(err.message);
      setRemoving(null);
    } finally {
      setBusy(false);
    }
  }

  const columns = [
    {
      key: "usuario",
      label: "Usuario",
      render: (u) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Person name={u.nombre} size={32} />
          {u.id === yo?.id && <small style={{ color: "var(--gray-400)" }}>(tú)</small>}
        </div>
      ),
    },
    { key: "email", label: "Correo", render: (u) => <span style={{ fontSize: 12.5, color: "var(--gray-500)" }}>{u.email}</span> },
    {
      key: "rol",
      label: "Rol",
      render: (u) => <Badge color={ROL_COLORS[rolNombre(u)] ?? COLORS.gray}>{capitalize(rolNombre(u))}</Badge>,
    },
    {
      key: "estado",
      label: "Estado",
      render: (u) => <Badge color={u.activo ? COLORS.green : COLORS.gray}>{u.activo ? "Activo" : "Inactivo"}</Badge>,
    },
    { key: "creado", label: "Creado", render: (u) => <span style={{ fontSize: 12, color: "var(--gray-400)" }}>{formatDate(u.fecha_creacion)}</span> },
    {
      key: "acciones",
      label: "Acciones",
      render: (u) => {
        const propio = u.id === yo?.id;
        return (
          <div className="icon-actions">
            {can("usuarios", "editar") && (
              <>
                <IconButton icon={Pencil} title="Editar" color={COLORS.navy} onClick={() => setEditing(u)} />
                <IconButton icon={KeyRound} title="Cambiar contraseña" color={COLORS.purple} onClick={() => setPasswordFor(u)} />
              </>
            )}
            {can("usuarios", "editar") && (u.activo ? (
              <IconButton
                icon={PowerOff}
                title={propio ? "No puedes desactivar tu propia cuenta" : "Desactivar"}
                color={COLORS.red}
                disabled={propio}
                onClick={() => setToggling(u)}
              />
            ) : (
              <IconButton icon={Power} title="Activar" color={COLORS.green} onClick={() => setToggling(u)} />
            ))}
            {can("usuarios", "eliminar") && (
              <IconButton
                icon={Trash2}
                title={propio ? "No puedes eliminar tu propia cuenta" : "Eliminar (solo si nunca registró actividad)"}
                color={COLORS.red}
                disabled={propio}
                onClick={() => setRemoving(u)}
              />
            )}
          </div>
        );
      },
    },
  ];

  return (
    <>
      <StatGrid cols={4}>
        <MiniStat value={loading ? "—" : stats.total} label="Usuarios registrados" color={COLORS.navy} />
        <MiniStat value={loading ? "—" : stats.activos} label="Activos" color={COLORS.green} />
        <MiniStat value={loading ? "—" : stats.inactivos} label="Inactivos" color={COLORS.gray} />
        <MiniStat value={loading ? "—" : stats.admins} label="Administradores" color={COLORS.purple} />
      </StatGrid>

      <div className="toolbar">
        <Tabs options={TABS} value={tab} onChange={setTab} label="Filtrar por estado" />
        <SearchInput value={query} onChange={setQuery} placeholder="Buscar nombre, correo o rol..." />
        <div className="toolbar__end">
          {can("usuarios", "crear") && (
            <Button icon={Plus} onClick={() => setCreating(true)} disabled={loading || !roles.length}>
              Nuevo usuario
            </Button>
          )}
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
            title={usuarios.length ? "Sin resultados" : "Aún no hay usuarios"}
            text={usuarios.length ? "Ningún usuario coincide con el filtro o la búsqueda." : "Crea el primero con el botón “Nuevo usuario”."}
          />
        }
        footer={
          <>
            <span>
              Mostrando {pageItems.length} de {filtered.length} usuarios
            </span>
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </>
        }
      />

      {(creating || editing) && (
        <UsuarioFormModal
          usuario={editing}
          roles={roles}
          esPropio={editing?.id === yo?.id}
          onClose={() => (editing ? setEditing(null) : setCreating(false))}
          onSaved={(saved) => {
            toast.success(editing ? "Usuario actualizado" : `Usuario ${saved.nombre} creado`);
            setEditing(null);
            setCreating(false);
            reload();
          }}
        />
      )}

      {passwordFor && (
        <PasswordModal
          usuario={passwordFor}
          onClose={() => setPasswordFor(null)}
          onSaved={() => {
            toast.success(`Contraseña de ${passwordFor.nombre} actualizada`);
            setPasswordFor(null);
          }}
        />
      )}

      {removing && (
        <ConfirmDialog
          title="Eliminar usuario"
          message={`${removing.nombre} se eliminará definitivamente. Solo es posible si nunca creó reservas ni validó pre-check-ins; si ya trabajó en el sistema, desactívalo para conservar el historial.`}
          confirmLabel="Eliminar"
          danger
          loading={busy}
          onConfirm={confirmRemove}
          onClose={() => setRemoving(null)}
        />
      )}

      {toggling && (
        <ConfirmDialog
          title={toggling.activo ? "Desactivar usuario" : "Activar usuario"}
          message={
            toggling.activo
              ? `${toggling.nombre} dejará de poder iniciar sesión y su sesión actual se cerrará de inmediato. Sus reservas y registros se conservan.`
              : `${toggling.nombre} volverá a poder iniciar sesión con su contraseña actual.`
          }
          confirmLabel={toggling.activo ? "Desactivar" : "Activar"}
          danger={toggling.activo}
          loading={busy}
          onConfirm={confirmToggle}
          onClose={() => setToggling(null)}
        />
      )}
    </>
  );
}