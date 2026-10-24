import { BedDouble, CalendarDays, CheckCircle2, Clock, CreditCard, Loader2, LogOut, Users } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Logo from "../../components/ui/Logo";
import { useAuth } from "../../context/AuthContext";
import { formatMoney, formatShortDate } from "../../utils/format";
import "../../components/ui/ui.css";
import "../../pages/PreCheckinPage.css";
import "../../pages/ReservarPage.css";

export const ESTADOS = {
  pendiente: { label: "Pendiente de confirmación", tono: "warn" },
  confirmada: { label: "Confirmada", tono: "ok" },
  checkin: { label: "Hospedado", tono: "ok" },
  checkout: { label: "Finalizada", tono: "muted" },
  cancelada: { label: "Cancelada", tono: "muted" },
  no_show: { label: "No se presentó", tono: "muted" },
};

/** Acceso o cuenta de quien está en las pantallas públicas: iniciar sesión, mis reservas, salir. */
function BarraCuenta() {
  const { status, user, esCliente, esPersonal, logout } = useAuth();
  const location = useLocation();
  if (status === "loading") return null;
  if (esCliente) {
    return (
      <nav className="rv__acct" aria-label="Tu cuenta">
        <span className="rv__acct-name">Hola, {user.nombres}</span>
        <Link to="/mis-reservas">Mis reservas</Link>
        <button type="button" onClick={logout} aria-label="Cerrar sesión">
          <LogOut size={14} /> Salir
        </button>
      </nav>
    );
  }
  if (esPersonal) {
    return (
      <nav className="rv__acct" aria-label="Tu cuenta">
        <Link to="/dashboard">Ir al panel</Link>
      </nav>
    );
  }
  const from = { pathname: location.pathname, search: location.search };
  return (
    <nav className="rv__acct" aria-label="Tu cuenta">
      <Link to="/login" state={{ from }}>
        Iniciar sesión
      </Link>
      <Link to="/login?modo=registro" state={{ from }} className="rv__acct-cta">
        Crear cuenta
      </Link>
    </nav>
  );
}

export function Campo({ label, required, hint, full, children }) {
  return (
    <label className={`pc-field${full ? " pc-field--full" : ""}`}>
      <span className="pc-field__label">
        {label}
        {required ? " *" : <small> (opcional)</small>}
      </span>
      {children}
      {hint && <span className="pc-field__hint">{hint}</span>}
    </label>
  );
}

/** Marco de las pantallas públicas de reserva: marca arriba y, a la derecha, el acceso o la cuenta del huésped. */
export function Pantalla({ hotel, children }) {
  return (
    <main className="pc rv">
      <header className="pc__brand">
        <Link to="/" className="rv__brand" aria-label="Ir al inicio">
          <Logo size={32} />
          <span>
            hestia<span className="pc__dot">.</span>
          </span>
        </Link>
        <BarraCuenta />
      </header>
      {children}
      <footer className="pc__footer">
        {hotel?.nombre ? `${hotel.nombre} · ` : ""}Tus datos se usan solo para gestionar tu reserva.
      </footer>
    </main>
  );
}

export function Contacto({ hotel, extra }) {
  const partes = [hotel?.telefono, hotel?.email].filter(Boolean);
  return (
    <p className="rv__contact">
      {extra}
      {partes.length > 0 ? ` Comunícate con el hotel: ${partes.join(" · ")}.` : " Comunícate directamente con el hotel."}
    </p>
  );
}

/** Resumen de una reserva (confirmación y consulta). */
export function Resumen({ r, hotel, onCancelar, cancelando, errorCancelar, onPagar, pagando, errorPago }) {
  const estado = ESTADOS[r.estado] ?? { label: r.estado, tono: "muted" };
  const [confirmar, setConfirmar] = useState(false);
  return (
    <section className="pc__card">
      <div className="rv__summary-head">
        <div>
          <p className="pc__eyebrow">Código de reserva</p>
          <p className="rv__code">{r.codigo}</p>
        </div>
        <span className={`rv__pill rv__pill--${estado.tono}`}>{estado.label}</span>
      </div>
      <dl className="pc__summary">
        <div>
          <dt>
            <CalendarDays size={13} /> Estadía
          </dt>
          <dd>
            {formatShortDate(r.fecha_checkin)} → {formatShortDate(r.fecha_checkout)} · {r.noches} {r.noches === 1 ? "noche" : "noches"}
          </dd>
        </div>
        <div>
          <dt>
            <BedDouble size={13} /> Habitación
          </dt>
          <dd>{r.tipo_habitacion}</dd>
        </div>
        <div>
          <dt>
            <Users size={13} /> Huéspedes
          </dt>
          <dd>{r.num_huespedes}</dd>
        </div>
        <div>
          <dt>
            <Clock size={13} /> Total estimado
          </dt>
          <dd>{formatMoney(r.precio_total)}</dd>
        </div>
      </dl>
      {Number(r.pagado) > 0 && (
        <p className="rv__paid">
          <CheckCircle2 size={15} /> Anticipo pagado: <strong>{formatMoney(r.pagado)}</strong>
        </p>
      )}
      {r.estado === "pendiente" && r.puede_pagar && onPagar && (
        <div className="rv__pay">
          <p>
            Para confirmar tu reserva paga el anticipo de <strong>{formatMoney(r.anticipo_monto)}</strong> con tarjeta, PSE o Nequi. El resto se paga en el hotel.
          </p>
          <button type="button" className="pc__submit" disabled={pagando} onClick={onPagar}>
            {pagando ? <Loader2 className="pc__spin" size={16} /> : <CreditCard size={16} />} Pagar anticipo con Wompi
          </button>
          {errorPago && (
            <p className="pc__error" role="alert">
              {errorPago}
            </p>
          )}
          <small>Serás llevado al sitio seguro de Wompi; aquí no guardamos datos de tu tarjeta.</small>
        </div>
      )}
      {r.estado === "pendiente" && !r.puede_pagar && (
        <p className="pc__notice">
          El hotel debe confirmar tu reserva
          {r.horas_vencimiento > 0 ? `; si no lo hace en ${r.horas_vencimiento} horas, se libera sola` : ""}. El pago se realiza directamente con el hotel; aquí no se cobra nada.
        </p>
      )}
      {r.estado === "pendiente" && r.puede_pagar && r.horas_vencimiento > 0 && (
        <p className="pc__help">Si no pagas el anticipo ni el hotel la confirma en {r.horas_vencimiento} horas, la reserva se libera sola.</p>
      )}
      {r.estado === "confirmada" && <p className="pc__notice">Tu reserva está confirmada. Check-in desde las {r.hora_checkin}.</p>}
      {r.motivo_cancelacion && <p className="pc__help">Motivo: {r.motivo_cancelacion}</p>}
      {r.registro === "completado" && (
        <p className="pc__help rv__registro">
          <CheckCircle2 size={14} /> Tu registro de alojamiento ya está enviado: el hotel lo revisará antes de tu llegada.
          {r.precheckin_enlace && (
            <>
              {" "}
              <a className="pc__link" href={r.precheckin_enlace}>
                Revisar o corregir
              </a>
            </>
          )}
        </p>
      )}
      {r.registro === "validado" && (
        <p className="pc__help rv__registro">
          <CheckCircle2 size={14} /> El hotel ya validó tu registro. Solo falta tu documento en recepción.
        </p>
      )}
      {r.registro === "enviado" && r.precheckin_enlace && (
        <a className={`pc__submit rv__cta${r.puede_pagar ? " rv__cta--sec" : ""}`} href={r.precheckin_enlace}>
          Completar mi registro ahora
        </a>
      )}
      {r.puede_cancelar && onCancelar && (
        <div className="rv__cancel">
          {!confirmar ? (
            <button type="button" className="pc__link pc__link--danger" onClick={() => setConfirmar(true)}>
              Cancelar esta reserva
            </button>
          ) : (
            <>
              <p className="pc__help">¿Seguro que quieres cancelar? Esta acción no se puede deshacer.</p>
              <div className="rv__row">
                <button type="button" className="rv__btn rv__btn--danger" disabled={cancelando} onClick={onCancelar}>
                  {cancelando && <Loader2 className="pc__spin" size={14} />} Sí, cancelar
                </button>
                <button type="button" className="rv__btn" onClick={() => setConfirmar(false)}>
                  No, mantenerla
                </button>
              </div>
            </>
          )}
          {errorCancelar && (
            <p className="pc__error" role="alert">
              {errorCancelar}
            </p>
          )}
        </div>
      )}
      <Contacto hotel={hotel ?? { telefono: r.hotel_telefono, email: r.hotel_email }} extra="¿Dudas o cambios?" />
    </section>
  );
}

