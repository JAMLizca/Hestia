import { Pencil, Plus, Shield, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { rolesApi } from "../api/services";
import { Button, Card, ErrorBanner, IconButton, InfoBanner, LoadingState, MiniStat, StatGrid, hexAlpha } from "../components/ui";
import { usePermisos } from "../context/PermisosContext";
import { useToast } from "../context/ToastContext";
import RoleFormModal from "../features/roles/RoleFormModal";
import "../features/roles/roles.css";
import { useApiData } from "../hooks/useApiData";
import { ConfirmDialog } from "../components/ui/Modal";
import { ROLES_BASE, rolColor, rolLabel } from "../utils/roles";
import { COLORS } from "../utils/status";

/**
 * Roles y permisos.
 */
export default function RolesPage() {
  const { can } = usePermisos();
  const toast = useToast();
  const { data, loading, error, reload } = useApiData({ permisos: () => rolesApi.permisos() });
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);

  const roles = useMemo(() => data.permisos?.roles ?? [], [data.permisos]);
  const modulos = useMemo(() => data.permisos?.modulos ?? [], [data.permisos]);
  const totalUsuarios = roles.reduce((sum, r) => sum + r.total_usuarios, 0);

  async function confirmRemove() {
    setBusy(true);
    try {
      await rolesApi.remove(removing.id);
      toast.success(`Rol ${rolLabel(removing.nombre)} eliminado`);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
      setRemoving(null);
    }
  }

  /** Por qué un rol no se puede eliminar (null si se puede). */
  const motivoNoEliminar = (r) =>
    ROLES_BASE.includes(r.nombre)
      ? "Es un rol del sistema y no se puede eliminar"
      : r.total_usuarios > 0
        ? "Tiene usuarios asignados: cámbiales el rol primero"
        : null;

  return (
    <>
      <StatGrid cols={3}>
        <MiniStat value={loading ? "—" : roles.length} label="Roles" color={COLORS.navy} />
        <MiniStat value={loading ? "—" : totalUsuarios} label="Usuarios asignados" color={COLORS.green} />
        <MiniStat value={loading ? "—" : modulos.length} label="Módulos con permisos" color={COLORS.gold} />
      </StatGrid>

      <ErrorBanner message={error} onRetry={reload} />
      {loading && !error && <LoadingState />}

      {!loading && !error && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <h2 className="section-title">Roles del sistema</h2>
            {can("roles", "crear") && (
              <Button icon={Plus} onClick={() => setCreating(true)}>
                Nuevo rol
              </Button>
            )}
          </div>

          <div className="role-grid">
            {roles.map((r) => {
              const color = rolColor(r.nombre);
              return (
                <Card key={r.id} padded={false} className="role-card">
                  <div className="role-card__top">
                    <div className="role-card__icon" style={{ background: hexAlpha(color, 0.12) }}>
                      <Shield size={17} strokeWidth={1.8} color={color} />
                    </div>
                    <div className="role-card__name">{rolLabel(r.nombre)}</div>
                    {can("roles", "editar") && <IconButton icon={Pencil} title={`Editar ${rolLabel(r.nombre)}`} color={COLORS.navy} onClick={() => setEditing(r)} />}
                    {can("roles", "eliminar") && (
                      <IconButton
                        icon={Trash2}
                        title={motivoNoEliminar(r) ?? `Eliminar ${rolLabel(r.nombre)}`}
                        color={COLORS.red}
                        disabled={Boolean(motivoNoEliminar(r))}
                        onClick={() => setRemoving(r)}
                      />
                    )}
                  </div>
                  <p className={`role-card__desc${r.description ? "" : " role-card__desc--empty"}`}>{r.description || "Sin descripción"}</p>
                  <div className="role-card__meta">
                    <span>
                      <strong>{r.total_usuarios}</strong> {r.total_usuarios === 1 ? "usuario" : "usuarios"}
                    </span>
                    <span>
                      <strong>{r.usuarios_activos}</strong> {r.usuarios_activos === 1 ? "activo" : "activos"}
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>

          <InfoBanner>
            La matriz muestra lo que el sistema aplica hoy y no se edita desde aquí: los permisos están definidos en el código de la API.
            Un rol nuevo solo accede a lo que está abierto a cualquier usuario autenticado.
          </InfoBanner>

          <Card padded={false} title={undefined}>
            <div className="perm" style={{ "--roles": roles.length }}>
              <div className="perm__row perm__row--head" role="row">
                <div>Módulo</div>
                {roles.map((r) => (
                  <div key={r.id}>{rolLabel(r.nombre)}</div>
                ))}
              </div>
              {modulos.map((m) => (
                <div className="perm__row" key={m.clave} role="row">
                  <div className="perm__module">{m.nombre}</div>
                  {roles.map((r) => {
                    const color = rolColor(r.nombre);
                    return (
                      <div className="perm__cell" key={r.id}>
                        <span className="perm__role-label">{rolLabel(r.nombre)}</span>
                        {m.acciones.map((a) => {
                          const permitido = a.roles.includes(r.nombre);
                          const nota = permitido ? a.notas?.[r.nombre] : undefined;
                          return (
                            <span
                              key={a.accion}
                              className={`perm-chip${permitido ? "" : " perm-chip--off"}`}
                              style={permitido ? { color, background: hexAlpha(color, 0.12) } : undefined}
                              title={nota ?? (permitido ? `${a.etiqueta}: permitido` : `${a.etiqueta}: sin acceso`)}
                              aria-label={`${m.nombre} · ${a.etiqueta}: ${permitido ? "permitido" : "sin acceso"}`}
                            >
                              {a.etiqueta}
                              {nota && "*"}
                            </span>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ))}
              <div className="perm__legend">
                Las acciones tachadas no están permitidas para ese rol. <strong>*</strong> Con restricción:{" "}
                {modulos
                  .flatMap((m) => m.acciones.flatMap((a) => Object.entries(a.notas ?? {}).map(([rol, nota]) => `${m.nombre} · ${a.etiqueta} (${rolLabel(rol)}): ${nota.toLowerCase()}`)))
                  .join("; ") || "ninguna"}
                .
              </div>
            </div>
          </Card>
        </>
      )}

      {removing && (
        <ConfirmDialog
          title="Eliminar rol"
          message={`El rol ${rolLabel(removing.nombre)} se eliminará definitivamente. No tiene usuarios asignados.`}
          confirmLabel="Eliminar"
          danger
          loading={busy}
          onConfirm={confirmRemove}
          onClose={() => setRemoving(null)}
        />
      )}

      {(creating || editing) && (
        <RoleFormModal
          rol={editing}
          onClose={() => (editing ? setEditing(null) : setCreating(false))}
          onSaved={(saved) => {
            toast.success(editing ? "Rol actualizado" : `Rol ${rolLabel(saved.nombre)} creado`);
            setEditing(null);
            setCreating(false);
            reload();
          }}
        />
      )}
    </>
  );
}