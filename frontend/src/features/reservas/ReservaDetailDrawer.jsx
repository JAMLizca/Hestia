import { Ban, CreditCard, LogIn, LogOut, Plus, ReceiptText, Trash2, CheckCircle2, Utensils } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { pagosApi, reservaServiciosApi, reservasApi, serviciosApi } from "../../api/services";
import { Badge, Button, Chip, EmptyState, ErrorBanner, IconButton, InfoBanner, LoadingState, TableView, Tabs } from "../../components/ui";
import { Field, Input, Select } from "../../components/ui/Form";
import { ConfirmDialog, Drawer } from "../../components/ui/Modal";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { indexById } from "../../hooks/useApiData";
import { formatMoney, formatShortDate, nights, parseDate } from "../../utils/format";
import { ESTADOS_CANCELABLES, ESTADOS_MODIFICABLES, nextStep } from "../../utils/hotel";
import { categoriaColor, RESERVA_ESTADOS } from "../../utils/status";
import "./reservas.css";

const STEP_ICONS = { confirmar: CheckCircle2, checkin: LogIn, checkout: LogOut };
const STEP_MESSAGES = {
  confirmar: "Reserva confirmada",
  checkin: "Check-in registrado. La habitación pasó a ocupada.",
  checkout: "Check-out registrado. La habitación pasó a limpieza.",
};
const METODOS_PAGO = ["Efectivo", "Tarjeta", "Transferencia"];

function formatDateTime(value) {
  const date = parseDate(value);
  if (!date) return "—";
  return date.toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/**
 * Detalle de una reserva:
 *  - GET /reservas/{id}, /reservas/{id}/resumen, /servicios/, /pagos/
 *  - Acciones: confirmar, check-in, check-out, cancelar, eliminar (solo administrador)
 *  - Consumo de servicios (POST/DELETE /reservas/{id}/servicios/)
 *  - Pagos (POST /reservas/{id}/pagos/)
 */
export default function ReservaDetailDrawer({ reservaId, huespedes = {}, habitaciones = {}, onClose, onChanged }) {
  const { user } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState("resumen");
  const [state, setState] = useState({ loading: true, error: "", reserva: null, resumen: null, consumos: [], pagos: [], catalogo: [] });
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState("");
  const [confirm, setConfirm] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      reservasApi.get(reservaId),
      reservasApi.resumen(reservaId).catch((err) => ({ __error: err.message })),
      reservaServiciosApi.list(reservaId),
      pagosApi.list(reservaId),
      serviciosApi.list(),
    ])
      .then(([reserva, resumen, consumos, pagos, catalogo]) => {
        if (active) setState({ loading: false, error: "", reserva, resumen, consumos, pagos, catalogo });
      })
      .catch((err) => active && setState((s) => ({ ...s, loading: false, error: err.message })));
    return () => {
      active = false;
    };
  }, [reservaId, version]);

  const refresh = useCallback(() => {
    setVersion((v) => v + 1);
    onChanged?.();
  }, [onChanged]);

  async function run(key, fn, successMessage) {
    setBusy(key);
    try {
      await fn();
      toast.success(successMessage);
      refresh();
      return true;
    } catch (err) {
      toast.error(err.message);
      return false;
    } finally {
      setBusy("");
    }
  }

  const { reserva, resumen, consumos, pagos, catalogo, loading, error } = state;
  const huesped = reserva && huespedes[reserva.huesped_id];
  const habitacion = reserva && habitaciones[reserva.habitacion_id];
  const nombreHuesped = huesped ? `${huesped.nombres} ${huesped.apellidos}` : resumen?.huesped_nombre;
  const numeroHabitacion = habitacion?.numero ?? resumen?.habitacion_numero;
  const estado = reserva && RESERVA_ESTADOS[reserva.estado];
  const step = reserva && nextStep(reserva.estado);
  const StepIcon = step && STEP_ICONS[step.action];
  const modificable = reserva && ESTADOS_MODIFICABLES.includes(reserva.estado);
  const cancelable = reserva && ESTADOS_CANCELABLES.includes(reserva.estado);
  const esAdmin = user?.rol === "administrador";

  return (
    <Drawer
      title={reserva ? `Reserva #${reserva.id}` : "Reserva"}
      subtitle={reserva ? `${nombreHuesped ?? "—"} · Habitación ${numeroHabitacion ?? "—"}` : undefined}
      headerExtra={estado && <div style={{ marginTop: 8 }}><Badge color={estado.color}>{estado.label}</Badge></div>}
      width={600}
      onClose={onClose}
    >
      {loading && <LoadingState />}
      <ErrorBanner message={error} onRetry={() => setVersion((v) => v + 1)} />

      {reserva && (
        <>
          <div className="reserva-detail__actions">
            {step && (
              <Button
                icon={StepIcon}
                loading={busy === step.action}
                onClick={() => run(step.action, () => reservasApi[step.action](reserva.id), STEP_MESSAGES[step.action])}
              >
                {step.label}
              </Button>
            )}
            {cancelable && (
              <Button variant="danger" icon={Ban} onClick={() => setConfirm("cancelar")}>
                Cancelar reserva
              </Button>
            )}
            {esAdmin && (
              <Button variant="outline" icon={Trash2} onClick={() => setConfirm("eliminar")}>
                Eliminar
              </Button>
            )}
          </div>

          <dl className="detail-grid">
            <div>
              <dt>Check-in previsto</dt>
              <dd>{formatShortDate(reserva.fecha_checkin_prevista)}</dd>
            </div>
            <div>
              <dt>Check-out previsto</dt>
              <dd>{formatShortDate(reserva.fecha_checkout_prevista)}</dd>
            </div>
            <div>
              <dt>Check-in real</dt>
              <dd>{formatDateTime(reserva.fecha_checkin_real)}</dd>
            </div>
            <div>
              <dt>Check-out real</dt>
              <dd>{formatDateTime(reserva.fecha_checkout_real)}</dd>
            </div>
            <div>
              <dt>Noches · Huéspedes</dt>
              <dd>
                {nights(reserva.fecha_checkin_prevista, reserva.fecha_checkout_prevista)} noches · {reserva.num_huespedes}{" "}
                {reserva.num_huespedes === 1 ? "persona" : "personas"}
              </dd>
            </div>
            <div>
              <dt>Creada</dt>
              <dd>{formatDateTime(reserva.fecha_creacion)}</dd>
            </div>
          </dl>

          <div className="divider" />

          <div className="reserva-detail__tabs">
            <Tabs
              label="Secciones de la reserva"
              value={tab}
              onChange={setTab}
              options={[
                { value: "resumen", label: "Resumen y saldo" },
                { value: "servicios", label: "Servicios", count: consumos.length },
                { value: "pagos", label: "Pagos", count: pagos.length },
              ]}
            />
          </div>

          {tab === "resumen" && <ResumenTab resumen={resumen} />}
          {tab === "servicios" && (
            <ServiciosTab
              reservaId={reserva.id}
              consumos={consumos}
              catalogo={catalogo}
              modificable={modificable}
              estado={reserva.estado}
              busy={busy}
              run={run}
            />
          )}
          {tab === "pagos" && (
            <PagosTab
              reservaId={reserva.id}
              pagos={pagos}
              saldo={resumen && !resumen.__error ? Number(resumen.saldo_pendiente) : null}
              cancelada={reserva.estado === "cancelada"}
              busy={busy}
              run={run}
            />
          )}
        </>
      )}

      {confirm === "cancelar" && (
        <ConfirmDialog
          title="Cancelar reserva"
          message={`La reserva #${reserva.id} pasará a estado cancelada y la habitación quedará libre para esas fechas.`}
          confirmLabel="Cancelar reserva"
          danger
          loading={busy === "cancelar"}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await run("cancelar", () => reservasApi.cancelar(reserva.id), "Reserva cancelada");
            setConfirm(null);
          }}
        />
      )}
      {confirm === "eliminar" && (
        <ConfirmDialog
          title="Eliminar reserva"
          message={`La reserva #${reserva.id} se eliminará definitivamente. Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar definitivamente"
          danger
          loading={busy === "eliminar"}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            setBusy("eliminar");
            try {
              await reservasApi.remove(reserva.id);
              toast.success("Reserva eliminada");
              onChanged?.();
              onClose();
            } catch (err) {
              toast.error(err.message);
              setBusy("");
              setConfirm(null);
            }
          }}
        />
      )}
    </Drawer>
  );
}

/* ── Resumen de costos (GET /reservas/{id}/resumen) ─────────── */
function ResumenTab({ resumen }) {
  if (!resumen) return null;
  if (resumen.__error) return <ErrorBanner message={`No se pudo obtener el resumen de costos: ${resumen.__error}`} />;
  const saldo = Number(resumen.saldo_pendiente);
  return (
    <div className="summary">
      <div className="summary__row">
        <span>
          Habitación {resumen.habitacion_numero} · {resumen.noches} {resumen.noches === 1 ? "noche" : "noches"}
        </span>
        <strong>{formatMoney(resumen.costo_habitacion)}</strong>
      </div>
      <div className="summary__row">
        <span>Servicios consumidos</span>
        <strong>{formatMoney(resumen.costo_servicios)}</strong>
      </div>
      {resumen.servicios.length > 0 && (
        <div className="summary__items">
          {resumen.servicios.map((s, i) => (
            <div key={i} className="summary__row" style={{ fontSize: 12 }}>
              <span>
                {s.servicio_nombre} × {s.cantidad} ({formatMoney(s.precio_unitario)} c/u)
              </span>
              <span>{formatMoney(s.subtotal)}</span>
            </div>
          ))}
        </div>
      )}
      <div className="summary__row summary__row--total">
        <span>Costo total</span>
        <strong>{formatMoney(resumen.costo_total)}</strong>
      </div>
      <div className="summary__row summary__row--paid">
        <span>Total pagado</span>
        <strong>{formatMoney(resumen.total_pagado)}</strong>
      </div>
      <div className={`summary__row${saldo > 0 ? " summary__row--balance" : " summary__row--paid"}`}>
        <span>Saldo pendiente</span>
        <strong>{formatMoney(resumen.saldo_pendiente)}</strong>
      </div>
    </div>
  );
}

/* ── Servicios consumidos ───────────────────────────────────── */
function ServiciosTab({ reservaId, consumos, catalogo, modificable, estado, busy, run }) {
  const [servicioId, setServicioId] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const catalogoById = indexById(catalogo);

  async function agregar(e) {
    e.preventDefault();
    const ok = await run(
      "agregar-servicio",
      () => reservaServiciosApi.add(reservaId, { servicio_id: Number(servicioId), cantidad: Number(cantidad) }),
      "Servicio agregado a la reserva",
    );
    if (ok) {
      setServicioId("");
      setCantidad(1);
    }
  }

  return (
    <>
      {modificable ? (
        catalogo.length ? (
          <form className="inline-form" onSubmit={agregar}>
            <Field label="Servicio" required>
              <Select
                placeholder="Selecciona un servicio"
                value={servicioId}
                onChange={(e) => setServicioId(e.target.value)}
                options={catalogo.map((s) => ({ value: String(s.id), label: `${s.nombre} — ${formatMoney(s.precio)}` }))}
              />
            </Field>
            <Field label="Cantidad" required>
              <Input type="number" min={1} value={cantidad} onChange={(e) => setCantidad(Math.max(1, Number(e.target.value) || 1))} />
            </Field>
            <Button type="submit" icon={Plus} loading={busy === "agregar-servicio"} disabled={!servicioId}>
              Agregar
            </Button>
          </form>
        ) : (
          <div style={{ marginBottom: 16 }}>
            <InfoBanner>No hay servicios en el catálogo. Créalos en el módulo Servicios.</InfoBanner>
          </div>
        )
      ) : (
        <div style={{ marginBottom: 16 }}>
          <InfoBanner>
            Una reserva en estado “{RESERVA_ESTADOS[estado]?.label}” no admite cambios en sus servicios.
          </InfoBanner>
        </div>
      )}

      {consumos.length === 0 ? (
        <EmptyState icon={Utensils} title="Sin servicios consumidos" text="Los servicios agregados a esta reserva aparecerán aquí." />
      ) : (
        <TableView
          compact
          rows={consumos}
          columns={[
            {
              key: "servicio",
              label: "Servicio",
              render: (c) => {
                const servicio = catalogoById[c.servicio_id];
                return (
                  <div>
                    <div style={{ color: "var(--navy-900)", fontWeight: 500 }}>{servicio?.nombre ?? `Servicio #${c.servicio_id}`}</div>
                    {servicio?.categoria && <Chip color={categoriaColor(servicio.categoria)}>{servicio.categoria}</Chip>}
                  </div>
                );
              },
            },
            { key: "cantidad", label: "Cant." },
            { key: "precio", label: "Precio", render: (c) => formatMoney(c.precio_unitario) },
            { key: "subtotal", label: "Subtotal", className: "td-strong", render: (c) => formatMoney(c.subtotal) },
            { key: "fecha", label: "Fecha", render: (c) => formatDateTime(c.fecha_consumo) },
            {
              key: "acciones",
              label: "",
              render: (c) =>
                modificable && (
                  <IconButton
                    icon={Trash2}
                    title="Quitar servicio"
                    color="#EF4444"
                    disabled={busy === `quitar-${c.id}`}
                    onClick={() => run(`quitar-${c.id}`, () => reservaServiciosApi.remove(reservaId, c.id), "Servicio quitado de la reserva")}
                  />
                ),
            },
          ]}
        />
      )}
    </>
  );
}

/* ── Pagos ──────────────────────────────────────────────────── */
function PagosTab({ reservaId, pagos, saldo, cancelada, busy, run }) {
  const [monto, setMonto] = useState(saldo > 0 ? String(saldo) : "");
  const [metodo, setMetodo] = useState("");

  async function registrar(e) {
    e.preventDefault();
    const ok = await run(
      "pago",
      () => pagosApi.create(reservaId, { monto: Number(monto), metodo_pago: metodo.trim() }),
      "Pago registrado",
    );
    if (ok) {
      setMonto("");
      setMetodo("");
    }
  }

  return (
    <>
      {cancelada ? (
        <div style={{ marginBottom: 16 }}>
          <InfoBanner>No se pueden registrar pagos sobre una reserva cancelada.</InfoBanner>
        </div>
      ) : (
        <form className="inline-form inline-form--pago" onSubmit={registrar}>
          <Field label="Monto" required hint={saldo != null ? `Saldo pendiente: ${formatMoney(saldo)}` : undefined}>
            <Input type="number" min="0.01" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} />
          </Field>
          <Field label="Método de pago" required>
            <Input list="metodos-pago" maxLength={30} value={metodo} onChange={(e) => setMetodo(e.target.value)} />
            <datalist id="metodos-pago">
              {METODOS_PAGO.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </Field>
          <Button type="submit" icon={CreditCard} loading={busy === "pago"} disabled={!(Number(monto) > 0) || !metodo.trim()}>
            Registrar
          </Button>
        </form>
      )}

      {pagos.length === 0 ? (
        <EmptyState icon={ReceiptText} title="Sin pagos registrados" text="Los pagos de esta reserva aparecerán aquí." />
      ) : (
        <TableView
          compact
          rows={pagos}
          columns={[
            { key: "monto", label: "Monto", className: "td-strong", render: (p) => formatMoney(p.monto) },
            { key: "metodo", label: "Método", render: (p) => p.metodo_pago },
            { key: "fecha", label: "Fecha", render: (p) => formatDateTime(p.fecha_pago) },
            { key: "estado", label: "Estado", render: (p) => <Badge color="#4CAF82">{p.estado}</Badge> },
          ]}
        />
      )}
    </>
  );
}
