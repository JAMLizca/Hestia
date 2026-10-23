import { Check, ClipboardCheck, Copy, Link2, MessageCircle, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { precheckinApi } from "../../api/services";
import { Badge, Button, EmptyState, ErrorBanner, InfoBanner, LoadingState, TableView } from "../../components/ui";
import { ConfirmDialog } from "../../components/ui/Modal";
import { useConfig } from "../../context/ConfigContext";
import { usePermisos } from "../../context/PermisosContext";
import { useToast } from "../../context/ToastContext";
import { formatShortDate } from "../../utils/format";
import { onlyDigits } from "../../utils/hotel";
import { PRECHECKIN_ESTADOS } from "../../utils/status";
import "./reservas.css";

const ESTADOS_ADMITEN = ["pendiente", "confirmada"];

const CAMPOS = [
  { key: "nombres", label: "Nombres" },
  { key: "apellidos", label: "Apellidos" },
  { key: "tipo_documento", label: "Tipo de documento" },
  { key: "documento_identidad", label: "Documento" },
  { key: "nacionalidad", label: "Nacionalidad" },
  { key: "fecha_nacimiento", label: "Nacimiento", format: (v) => (v ? v.split("-").reverse().join("/") : "") },
  { key: "telefono", label: "Teléfono" },
  { key: "email", label: "Correo" },
];

const MOTIVOS = { turismo: "Turismo", negocios: "Negocios", familia: "Visita a familiares", salud: "Salud", estudio: "Estudio", otro: "Otro" };

/** Copia al portapapeles; con http (sin contexto seguro) navigator.clipboard no existe y se usa un textarea. */
async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = texto;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

/** Número para wa.me: solo dígitos; un móvil colombiano de 10 dígitos recibe el prefijo 57. */
function numeroWhatsApp(telefono) {
  const digits = onlyDigits(telefono);
  return digits.length === 10 && digits.startsWith("3") ? `57${digits}` : digits;
}

/**
 * Pestaña "Pre-check-in" del detalle de reserva: crea el enlace que se le envía al huésped, muestra lo
 * que él completó (comparado con lo que ya hay en su registro) y lo valida.
 */
export default function PreCheckinPanel({ reserva, huesped, onChanged }) {
  const toast = useToast();
  const { can } = usePermisos();
  const puedeEditar = can("reservas", "editar"); // crear/regenerar el enlace y validar es editar la reserva
  const { config } = useConfig();
  const [version, setVersion] = useState(0);
  const [state, setState] = useState({ loading: true, error: "", pc: null });
  const [busy, setBusy] = useState("");
  const [confirm, setConfirm] = useState(null);

  useEffect(() => {
    let active = true;
    precheckinApi
      .get(reserva.id)
      .then((pc) => active && setState({ loading: false, error: "", pc }))
      .catch((err) => active && setState({ loading: false, error: err.message, pc: null }));
    return () => {
      active = false;
    };
  }, [reserva.id, version]);

  const refresh = useCallback(() => {
    setVersion((v) => v + 1);
    onChanged?.();
  }, [onChanged]);

  async function run(key, fn, success) {
    setBusy(key);
    try {
      await fn();
      if (success) toast.success(success);
      refresh();
      return true;
    } catch (err) {
      toast.error(err.message);
      return false;
    } finally {
      setBusy("");
    }
  }

  const { pc, loading, error } = state;
  const admite = ESTADOS_ADMITEN.includes(reserva.estado);
  // VITE_PUBLIC_URL: dominio público del panel (ej. https://hotel.com). Sin él se usa el de la pestaña actual,
  // que en desarrollo es localhost y no sirve para enviárselo a un huésped.
  const base = (import.meta.env.VITE_PUBLIC_URL || window.location.origin).replace(/\/$/, "");
  const url = pc ? `${base}${pc.enlace}` : "";
  const mensaje = pc
    ? `Hola ${huesped?.nombres ?? ""}, para agilizar tu llegada a ${config.nombre} completa tu registro aquí: ${url}`
    : "";
  const telefono = huesped?.telefono;
  const whatsapp = `https://wa.me/${numeroWhatsApp(telefono)}?text=${encodeURIComponent(mensaje)}`;
  const declarado = pc?.datos?.titular;
  const registrado = pc?.huesped;
  const documentoDistinto =
    declarado && registrado && declarado.documento_identidad.trim().toUpperCase() !== String(registrado.documento_identidad).toUpperCase();

  async function handleCopy() {
    if (await copiar(url)) toast.success("Enlace copiado");
    else toast.error("No se pudo copiar: selecciona el enlace y cópialo a mano");
  }

  if (loading) return <LoadingState />;

  return (
    <div className="precheckin">
      <ErrorBanner message={error} onRetry={() => setVersion((v) => v + 1)} />

      {!pc && !error && (
        <>
          {admite ? (
            <EmptyState
              icon={ClipboardCheck}
              title="Aún no se pidió el pre-check-in"
              text="Crea un enlace único para que el huésped complete sus datos y los de sus acompañantes antes de llegar. Tú los revisas y los validas."
              action={
                puedeEditar && (
                  <Button icon={Link2} loading={busy === "crear"} onClick={() => run("crear", () => precheckinApi.create(reserva.id), "Enlace creado")}>
                    Crear enlace de pre-check-in
                  </Button>
                )
              }
            />
          ) : (
            <InfoBanner>El pre-check-in solo se puede pedir en reservas pendientes o confirmadas.</InfoBanner>
          )}
        </>
      )}

      {pc && (
        <>
          <div className="precheckin__status">
            <Badge color={PRECHECKIN_ESTADOS[pc.estado]?.color}>{PRECHECKIN_ESTADOS[pc.estado]?.label}</Badge>
            <span className="muted">
              {pc.estado === "validado" && pc.fecha_validacion && `Validado el ${formatShortDate(pc.fecha_validacion)}`}
              {pc.estado === "completado" && pc.fecha_completado && `Enviado el ${formatShortDate(pc.fecha_completado)}`}
              {pc.estado === "enviado" && "El huésped aún no ha completado el formulario"}
            </span>
          </div>

          {pc.estado !== "validado" && admite && (
            <div className="precheckin__link">
              <input className="input" readOnly value={url} aria-label="Enlace de pre-check-in" onFocus={(e) => e.target.select()} />
              <div className="precheckin__link-actions">
                <Button variant="outline" icon={Copy} onClick={handleCopy}>
                  Copiar
                </Button>
                <a className="btn btn--outline" href={whatsapp} target="_blank" rel="noopener noreferrer">
                  <MessageCircle size={15} strokeWidth={1.75} /> WhatsApp
                </a>
                {puedeEditar && (
                  <Button variant="outline" icon={RefreshCw} onClick={() => setConfirm("regenerar")}>
                    Enlace nuevo
                  </Button>
                )}
              </div>
              <p className="precheckin__hint">
                Quien tenga este enlace puede completar el registro de esta reserva: envíalo solo al huésped. Si se comparte por error, genera uno nuevo y el anterior deja de funcionar.
              </p>
            </div>
          )}

          {pc.datos && (
            <>
              <h4 className="precheckin__title">Datos del titular</h4>
              <dl className="detail-grid">
                {CAMPOS.map(({ key, label, format }) => {
                  const nuevo = declarado[key] ?? "";
                  const previo = registrado?.[key] ?? "";
                  const distinto = String(nuevo).toUpperCase() !== String(previo).toUpperCase();
                  const mostrar = (v) => (format ? format(v) : v) || "—";
                  return (
                    <div key={key}>
                      <dt>{label}</dt>
                      <dd>
                        {mostrar(nuevo)}
                        {pc.estado === "completado" && distinto && (
                          <small className={`precheckin__diff${key === "documento_identidad" ? " precheckin__diff--alert" : ""}`}>
                            {previo ? `Registrado: ${mostrar(previo)}` : "Dato nuevo"}
                          </small>
                        )}
                      </dd>
                    </div>
                  );
                })}
                {declarado.procedencia && (
                  <div>
                    <dt>Procedencia</dt>
                    <dd>{declarado.procedencia}</dd>
                  </div>
                )}
                {pc.datos.hora_llegada && (
                  <div>
                    <dt>Llegada estimada</dt>
                    <dd>{pc.datos.hora_llegada.slice(0, 5)}</dd>
                  </div>
                )}
                {pc.datos.motivo_viaje && (
                  <div>
                    <dt>Motivo del viaje</dt>
                    <dd>{MOTIVOS[pc.datos.motivo_viaje] ?? pc.datos.motivo_viaje}</dd>
                  </div>
                )}
                {pc.datos.notas && (
                  <div className="detail-grid__full">
                    <dt>Notas del huésped</dt>
                    <dd style={{ whiteSpace: "pre-wrap" }}>{pc.datos.notas}</dd>
                  </div>
                )}
              </dl>

              {pc.datos.acompanantes.length > 0 && (
                <>
                  <h4 className="precheckin__title">Acompañantes ({pc.datos.acompanantes.length})</h4>
                  <TableView
                    compact
                    rowKey="documento_identidad"
                    rows={pc.datos.acompanantes}
                    columns={[
                      { key: "nombre", label: "Nombre", render: (a) => `${a.nombres} ${a.apellidos}` },
                      { key: "doc", label: "Documento", render: (a) => `${a.tipo_documento} ${a.documento_identidad}` },
                      { key: "nac", label: "Nacionalidad", render: (a) => a.nacionalidad },
                      { key: "nacimiento", label: "Nacimiento", render: (a) => a.fecha_nacimiento.split("-").reverse().join("/") },
                    ]}
                  />
                  <p className="precheckin__hint">
                    Los acompañantes se conservan aquí como respaldo del registro de alojamiento; no se crean como huéspedes.
                  </p>
                </>
              )}

              {pc.estado === "completado" && (
                <div className="precheckin__validate">
                  {documentoDistinto && (
                    <InfoBanner>
                      El documento declarado ({declarado.documento_identidad}) no coincide con el registrado ({registrado.documento_identidad}). Confírmalo con el huésped antes de validar.
                    </InfoBanner>
                  )}
                  {puedeEditar && (
                    <>
                      <Button icon={Check} loading={busy === "validar"} onClick={() => (documentoDistinto ? setConfirm("documento") : validar(false))}>
                        Validar y aplicar al huésped
                      </Button>
                      <p className="precheckin__hint">Los datos del titular reemplazan los del registro del huésped (nombre, nacionalidad, nacimiento, teléfono y correo).</p>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}

      {confirm === "regenerar" && (
        <ConfirmDialog
          title="Generar un enlace nuevo"
          message="El enlace anterior dejará de funcionar. Lo que el huésped ya envió se conserva."
          confirmLabel="Generar enlace nuevo"
          loading={busy === "crear"}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await run("crear", () => precheckinApi.create(reserva.id), "Enlace nuevo generado");
            setConfirm(null);
          }}
        />
      )}
      {confirm === "documento" && (
        <ConfirmDialog
          title="Actualizar el documento del huésped"
          message={`El registro dice ${registrado?.documento_identidad} y el huésped declaró ${declarado?.documento_identidad}. ¿Reemplazar el documento registrado por el declarado?`}
          confirmLabel="Sí, actualizar documento"
          danger
          loading={busy === "validar"}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await validar(true);
            setConfirm(null);
          }}
        />
      )}
    </div>
  );

  function validar(actualizarDocumento) {
    return run("validar", () => precheckinApi.validar(reserva.id, { actualizar_documento: actualizarDocumento }), "Datos validados y aplicados al huésped");
  }
}
