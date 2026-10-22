import { Bell, ChevronDown, HelpCircle, KeyRound, LogOut } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { habitacionesApi, reservasApi } from "../../api/services";
import { useAuth } from "../../context/AuthContext";
import { useConfig } from "../../context/ConfigContext";
import { capitalize, initials, todayISO } from "../../utils/format";
import { dateOnly } from "../../utils/hotel";
import { COLORS } from "../../utils/status";

/** Cierra el menú al hacer clic fuera o al pulsar Escape. */
function useDismiss(open, onClose) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onPointer = (e) => ref.current && !ref.current.contains(e.target) && onClose();
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
  return ref;
}

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

/**
 * Avisos operativos calculados con los datos reales de la API (reservas y habitaciones).
 * No hay un endpoint de notificaciones: cada aviso es un conteo que lleva a su pantalla.
 */
function buildAlerts(reservas, habitaciones) {
  const hoy = todayISO();
  const llegadas = reservas.filter((r) => ["pendiente", "confirmada"].includes(r.estado) && dateOnly(r.fecha_checkin_prevista) === hoy).length;
  const pendientes = reservas.filter((r) => r.estado === "pendiente").length;
  const salidas = reservas.filter((r) => r.estado === "checkin" && dateOnly(r.fecha_checkout_prevista) <= hoy).length;
  const limpieza = habitaciones.filter((h) => h.estado === "limpieza").length;
  const mantenimiento = habitaciones.filter((h) => h.estado === "mantenimiento").length;

  const alerts = [];
  if (llegadas) alerts.push({ id: "llegadas", to: "/reservas", color: COLORS.gold, text: `${plural(llegadas, "llegada prevista", "llegadas previstas")} hoy`, hint: "Pendientes de check-in" });
  if (salidas) alerts.push({ id: "salidas", to: "/reservas", color: COLORS.orange, text: `${plural(salidas, "salida por registrar", "salidas por registrar")}`, hint: "Check-out de hoy o atrasado" });
  if (pendientes) alerts.push({ id: "pendientes", to: "/reservas", color: COLORS.navy, text: `${plural(pendientes, "reserva pendiente", "reservas pendientes")} de confirmar` });
  if (limpieza) alerts.push({ id: "limpieza", to: "/habitaciones", color: COLORS.cyan, text: `${plural(limpieza, "habitación", "habitaciones")} en limpieza`, hint: "Márcalas disponibles al terminar" });
  if (mantenimiento) alerts.push({ id: "mantenimiento", to: "/habitaciones", color: COLORS.gray, text: `${plural(mantenimiento, "habitación", "habitaciones")} en mantenimiento` });
  return alerts;
}

export function NotificationsMenu({ open, onToggle, onClose }) {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [failed, setFailed] = useState(false);
  const ref = useDismiss(open, onClose);

  const load = useCallback(async () => {
    try {
      const [reservas, habitaciones] = await Promise.all([reservasApi.list(), habitacionesApi.list()]);
      setAlerts(buildAlerts(reservas, habitaciones));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  // Se actualizan al entrar, cada minuto y cada vez que se abre el menú.
  useEffect(() => {
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, [load]);
  useEffect(() => {
    if (open) load();
  }, [open, load]);

  return (
    <div className="header__menu-wrap" ref={ref}>
      <button
        type="button"
        className="header__icon-btn"
        title="Notificaciones"
        aria-label={alerts.length ? `Notificaciones: ${alerts.length}` : "Notificaciones"}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={onToggle}
      >
        <Bell size={18} strokeWidth={1.75} />
        {alerts.length > 0 && <span className="header__badge">{alerts.length}</span>}
      </button>
      {open && (
        <div className="header__panel" role="dialog" aria-label="Notificaciones">
          <div className="panel__title">Pendientes de hoy</div>
          {failed ? (
            <p className="panel__empty">No se pudieron cargar los avisos. Intenta de nuevo en un momento.</p>
          ) : alerts.length === 0 ? (
            <p className="panel__empty">Todo al día: no hay llegadas, salidas ni habitaciones pendientes.</p>
          ) : (
            <ul className="panel__list">
              {alerts.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    className="panel__item"
                    onClick={() => {
                      onClose();
                      navigate(a.to);
                    }}
                  >
                    <span className="panel__dot" style={{ background: a.color }} />
                    <span>
                      {a.text}
                      {a.hint && <small>{a.hint}</small>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function HelpMenu({ open, onToggle, onClose }) {
  const navigate = useNavigate();
  const { config } = useConfig();
  const ref = useDismiss(open, onClose);
  const contacto = [config.telefono, config.email].filter(Boolean).join(" · ");

  return (
    <div className="header__menu-wrap" ref={ref}>
      <button type="button" className="header__icon-btn" title="Ayuda" aria-label="Ayuda" aria-haspopup="dialog" aria-expanded={open} onClick={onToggle}>
        <HelpCircle size={18} strokeWidth={1.75} />
      </button>
      {open && (
        <div className="header__panel" role="dialog" aria-label="Ayuda">
          <div className="panel__title">Guía rápida</div>
          <div className="panel__section" style={{ borderTop: 0, paddingTop: 0 }}>
            <h4>Ciclo de una reserva</h4>
            Pendiente → Confirmada → Check-in → Check-out. Solo se puede cancelar mientras está pendiente o confirmada.
            <h4>Habitaciones</h4>
            El check-in exige que la habitación esté disponible. Tras el check-out pasa a limpieza: márcala disponible antes de la siguiente llegada.
            <h4>Pagos</h4>
            Un pago no puede superar el saldo pendiente ni registrarse en una reserva cancelada.
            <h4>Permisos</h4>
            Si una acción no te aparece o recibes “No tienes permisos”, tu rol no la incluye.{" "}
            <button
              type="button"
              style={{ color: "var(--gold)", fontWeight: 500, textDecoration: "underline", background: "none", padding: 0 }}
              onClick={() => {
                onClose();
                navigate("/roles");
              }}
            >
              Ver permisos por rol
            </button>
          </div>
          {contacto && (
            <div className="panel__section">
              <h4>Contacto del hotel</h4>
              {contacto}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function UserMenu({ open, onToggle, onClose, onChangePassword }) {
  const { user, logout } = useAuth();
  const ref = useDismiss(open, onClose);
  const nombre = user?.nombre ?? "";
  const rol = capitalize(user?.rol ?? "");

  return (
    <div className="header__menu-wrap" ref={ref}>
      <button type="button" className="header__user" aria-haspopup="menu" aria-expanded={open} onClick={onToggle} aria-label="Menú de usuario">
        <div className="header__avatar">{initials(nombre)}</div>
        <div className="header__user-text">
          <div className="header__user-name">{nombre}</div>
          {rol && <div className="header__user-role">{rol}</div>}
        </div>
        <ChevronDown size={14} strokeWidth={1.75} color="var(--gray-400)" className="header__chevron" />
      </button>
      {open && (
        <div className="header__panel header__panel--narrow" role="menu">
          <div className="panel__user">
            <strong>{nombre}</strong>
            {user?.email && <span>{user.email}</span>}
            {rol && <span>{rol}</span>}
          </div>
          <div className="panel__menu">
            <button
              type="button"
              role="menuitem"
              className="panel__item"
              onClick={() => {
                onClose();
                onChangePassword();
              }}
            >
              <KeyRound size={15} strokeWidth={1.75} />
              Cambiar mi contraseña
            </button>
            <button type="button" role="menuitem" className="panel__item panel__item--danger" onClick={logout}>
              <LogOut size={15} strokeWidth={1.75} />
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
