import { BedDouble, CalendarDays, CheckCircle2, Clock, CreditCard, Loader2, Search, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { reservasWebApi } from "../api/services";
import Logo from "../components/ui/Logo";
import { configureFormat, formatMoney, formatShortDate, nights as contarNoches, todayISO } from "../utils/format";
import { PREFERENCIAS_BANDERAS, PREFERENCIAS_OPCIONES } from "../utils/status";
import "../components/ui/ui.css";
import "./PreCheckinPage.css";
import "./ReservarPage.css";

const TIPOS_DOCUMENTO = [
  { value: "CC", label: "Cédula de ciudadanía" },
  { value: "CE", label: "Cédula de extranjería" },
  { value: "TI", label: "Tarjeta de identidad" },
  { value: "PA", label: "Pasaporte" },
  { value: "PEP", label: "Permiso especial de permanencia" },
  { value: "OTRO", label: "Otro documento" },
];

const ESTADOS = {
  pendiente: { label: "Pendiente de confirmación", tono: "warn" },
  confirmada: { label: "Confirmada", tono: "ok" },
  checkin: { label: "Hospedado", tono: "ok" },
  checkout: { label: "Finalizada", tono: "muted" },
  cancelada: { label: "Cancelada", tono: "muted" },
  no_show: { label: "No se presentó", tono: "muted" },
};

// Se recuerda en la pestaña para poder confirmar el pago cuando Wompi devuelve al huésped a esta página.
const CLAVE_RESERVA = "hestia_reserva_web";
const recordar = (codigo, documento) => {
  try {
    sessionStorage.setItem(CLAVE_RESERVA, JSON.stringify({ codigo, documento }));
  } catch {
    /* sin almacenamiento: se le pedirá el documento */
  }
};
const recordada = (codigo) => {
  try {
    const v = JSON.parse(sessionStorage.getItem(CLAVE_RESERVA) ?? "null");
    return v && v.codigo === codigo ? v.documento : "";
  } catch {
    return "";
  }
};

const sumarDias = (iso, n) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return todayISO(d);
};

/** Solo lo que el huésped pidió; null si no pidió nada. */
function preferenciasEnvio(p) {
  const out = {};
  ["piso", "vista", "cama"].forEach((k) => p[k] && (out[k] = p[k]));
  PREFERENCIAS_BANDERAS.forEach(({ key }) => p[key] && (out[key] = true));
  return Object.keys(out).length ? out : null;
}

function Campo({ label, required, hint, full, children }) {
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

function Pantalla({ hotel, children }) {
  return (
    <main className="pc rv">
      <header className="pc__brand">
        <Logo size={32} />
        <span>
          hestia<span className="pc__dot">.</span>
        </span>
      </header>
      {children}
      <footer className="pc__footer">
        {hotel?.nombre ? `${hotel.nombre} · ` : ""}Tus datos se usan solo para gestionar tu reserva.
      </footer>
    </main>
  );
}

function Contacto({ hotel, extra }) {
  const partes = [hotel?.telefono, hotel?.email].filter(Boolean);
  return (
    <p className="rv__contact">
      {extra}
      {partes.length > 0 ? ` Comunícate con el hotel: ${partes.join(" · ")}.` : " Comunícate directamente con el hotel."}
    </p>
  );
}

/** Resumen de una reserva (confirmación y consulta). */
function Resumen({ r, hotel, onCancelar, cancelando, errorCancelar, onPagar, pagando, errorPago }) {
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
      {r.precheckin_enlace && (
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

function Reservar({ hotel }) {
  const hoy = todayISO();
  // La página principal (/) envía las fechas elegidas y el tipo: ?llegada=&salida=&huespedes=&tipo=
  const [params] = useSearchParams();
  const pedido = useMemo(() => {
    const llegada = params.get("llegada") ?? "";
    const salida = params.get("salida") ?? "";
    const huespedes = Number(params.get("huespedes"));
    const valido = /^\d{4}-\d{2}-\d{2}$/.test(llegada) && /^\d{4}-\d{2}-\d{2}$/.test(salida) && llegada >= hoy && salida > llegada;
    return valido ? { checkin: llegada, checkout: salida, huespedes: huespedes >= 1 && huespedes <= 10 ? huespedes : 1, tipo: Number(params.get("tipo")) || null } : null;
  }, [params, hoy]);
  const [fechas, setFechas] = useState(() =>
    pedido ? { checkin: pedido.checkin, checkout: pedido.checkout, huespedes: pedido.huespedes } : { checkin: sumarDias(hoy, 1), checkout: sumarDias(hoy, 2), huespedes: 1 },
  );
  const [buscando, setBuscando] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState("");
  const [tipos, setTipos] = useState(null);
  const [elegido, setElegido] = useState(null);
  const [huesped, setHuesped] = useState({ tipo_documento: "CC", documento_identidad: "", nombres: "", apellidos: "", email: "", telefono: "" });
  const [notas, setNotas] = useState("");
  const [prefs, setPrefs] = useState({ piso: "", vista: "", cama: "", tranquila: false, accesible: false });
  const [trampa, setTrampa] = useState("");
  const [consent, setConsent] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [reserva, setReserva] = useState(null);

  // Cambiar fechas o huéspedes invalida lo mostrado: el precio y el cupo se vuelven a consultar.
  const editarFechas = (fn) => {
    setTipos(null);
    setElegido(null);
    setFechas(fn);
  };

  const noches = contarNoches(fechas.checkin, fechas.checkout);
  const [pagando, setPagando] = useState(false);
  const [errorPago, setErrorPago] = useState("");

  async function pagar() {
    setErrorPago("");
    setPagando(true);
    try {
      const { url } = await reservasWebApi.pagar({ codigo: reserva.codigo, documento_identidad: huesped.documento_identidad.trim() });
      window.location.assign(url); // checkout de Wompi
    } catch (err) {
      setErrorPago(err.message);
      setPagando(false);
    }
  }

  async function buscar(e, preseleccion = null) {
    e?.preventDefault();
    setErrorBusqueda("");
    setError("");
    setElegido(null);
    setBuscando(true);
    try {
      const encontrados = await reservasWebApi.disponibilidad(fechas);
      setTipos(encontrados);
      if (preseleccion) setElegido(encontrados.find((t) => t.tipo_habitacion_id === preseleccion) ?? null);
    } catch (err) {
      setTipos(null);
      setErrorBusqueda(err.message);
    } finally {
      setBuscando(false);
    }
  }

  // Viene de la página principal con fechas y habitación ya elegidas: se busca solo y se deja elegida.
  useEffect(() => {
    if (pedido) buscar(null, pedido.tipo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function enviar(e) {
    e.preventDefault();
    setError("");
    setEnviando(true);
    try {
      const r = await reservasWebApi.crear({
        tipo_habitacion_id: elegido.tipo_habitacion_id,
        fecha_checkin: fechas.checkin,
        fecha_checkout: fechas.checkout,
        num_huespedes: Number(fechas.huespedes),
        huesped,
        notas: notas.trim() || null,
        preferencias: preferenciasEnvio(prefs),
        sitio_web: trampa || null,
      });
      recordar(r.codigo, huesped.documento_identidad.trim());
      setReserva(r);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err.message);
      if (err.status === 409) setTipos(null); // la disponibilidad cambió: que vuelva a buscar
    } finally {
      setEnviando(false);
    }
  }

  if (reserva) {
    return (
      <>
        <section className="pc__card pc__state pc__state--ok">
          <CheckCircle2 size={40} strokeWidth={1.5} />
          <h1>¡Recibimos tu solicitud!</h1>
          <p>Guarda tu código: lo necesitas, junto con tu documento, para consultar o cancelar la reserva.</p>
        </section>
        <Resumen r={reserva} hotel={hotel} onPagar={pagar} pagando={pagando} errorPago={errorPago} />
      </>
    );
  }

  const setH = (campo) => (e) => setHuesped((h) => ({ ...h, [campo]: e.target.value }));

  return (
    <>
      <form className="pc__card" onSubmit={buscar}>
        <h2>1. ¿Cuándo vienes?</h2>
        <div className="pc-grid pc-grid--spaced">
          <Campo label="Llegada" required>
            <input className="input" type="date" min={hoy} value={fechas.checkin} required name="llegada"
              onChange={(e) => editarFechas((f) => ({ ...f, checkin: e.target.value, checkout: f.checkout <= e.target.value ? sumarDias(e.target.value, 1) : f.checkout }))} />
          </Campo>
          <Campo label="Salida" required>
            <input className="input" type="date" min={sumarDias(fechas.checkin, 1)} value={fechas.checkout} required name="salida"
              onChange={(e) => editarFechas((f) => ({ ...f, checkout: e.target.value }))} />
          </Campo>
          <Campo label="Huéspedes" required>
            <select className="input" value={fechas.huespedes} name="huespedes" onChange={(e) => editarFechas((f) => ({ ...f, huespedes: Number(e.target.value) }))}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? "persona" : "personas"}
                </option>
              ))}
            </select>
          </Campo>
        </div>
        {errorBusqueda && (
          <p className="pc__error" role="alert">
            {errorBusqueda}
          </p>
        )}
        <button type="submit" className="pc__submit" disabled={buscando || noches < 1}>
          {buscando ? <Loader2 className="pc__spin" size={16} /> : <Search size={16} />} Ver habitaciones disponibles
        </button>
      </form>

      {tipos && (
        <section className="pc__card">
          <h2>2. Elige tu habitación</h2>
          <p className="pc__help">
            {formatShortDate(fechas.checkin)} → {formatShortDate(fechas.checkout)} · {noches} {noches === 1 ? "noche" : "noches"}
          </p>
          {tipos.length === 0 ? (
            <Contacto hotel={hotel} extra="No hay habitaciones disponibles para esas fechas y esa cantidad de personas. Prueba con otras fechas." />
          ) : (
            <ul className="rv__types">
              {tipos.map((t) => (
                <li key={t.tipo_habitacion_id} className={`rv__type${elegido?.tipo_habitacion_id === t.tipo_habitacion_id ? " rv__type--on" : ""}`}>
                  <div className="rv__type-main">
                    <strong>{t.nombre}</strong>
                    <span className="rv__meta">
                      Hasta {t.capacidad_maxima} {t.capacidad_maxima === 1 ? "persona" : "personas"} · {t.camas} {t.camas === 1 ? "cama" : "camas"}
                      {t.metros_cuadrados ? ` · ${Number(t.metros_cuadrados)} m²` : ""}
                    </span>
                    {t.descripcion && <span className="rv__desc">{t.descripcion}</span>}
                    {t.disponibles <= 2 && <span className="rv__few">Quedan {t.disponibles}</span>}
                  </div>
                  <div className="rv__type-price">
                    <strong>{formatMoney(t.precio_total)}</strong>
                    <span className="rv__meta">{formatMoney(t.precio_noche)} por noche</span>
                    <button type="button" className="rv__btn rv__btn--primary" onClick={() => setElegido(t)}>
                      {elegido?.tipo_habitacion_id === t.tipo_habitacion_id ? "Elegida" : "Elegir"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tipos && elegido && (
        <form className="pc__form" onSubmit={enviar}>
          <section className="pc__card">
            <h2>3. Tus datos</h2>
            <p className="pc__help">
              Titular de la reserva.{" "}
              {hotel.pagos_activos
                ? `Al terminar podrás pagar un anticipo del ${hotel.anticipo_porcentaje}% para asegurar tu habitación; el resto se paga en el hotel.`
                : "El hotel la confirmará contigo; no se cobra nada en línea."}
            </p>
            <div className="pc-grid">
              <Campo label="Tipo de documento" required>
                <select className="input" value={huesped.tipo_documento} onChange={setH("tipo_documento")} name="tipo-documento">
                  {TIPOS_DOCUMENTO.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo label="Número de documento" required>
                <input className="input" value={huesped.documento_identidad} onChange={setH("documento_identidad")} required minLength={3} maxLength={30} autoComplete="off" name="documento" />
              </Campo>
              <Campo label="Nombres" required>
                <input className="input" value={huesped.nombres} onChange={setH("nombres")} required maxLength={100} autoComplete="given-name" name="nombres" />
              </Campo>
              <Campo label="Apellidos" required>
                <input className="input" value={huesped.apellidos} onChange={setH("apellidos")} required maxLength={100} autoComplete="family-name" name="apellidos" />
              </Campo>
              <Campo label="Correo electrónico" required>
                <input className="input" type="email" value={huesped.email} onChange={setH("email")} required maxLength={150} autoComplete="email" name="email" />
              </Campo>
              <Campo label="Teléfono móvil" required>
                <input className="input" type="tel" value={huesped.telefono} onChange={setH("telefono")} required minLength={7} maxLength={30} autoComplete="tel" name="telefono" />
              </Campo>
              {[
                ["piso", "Piso"],
                ["vista", "Vista"],
                ["cama", "Cama"],
              ].map(([clave, etiqueta]) => (
                <Campo key={clave} label={etiqueta}>
                  <select className="input" value={prefs[clave]} onChange={(e) => setPrefs((p) => ({ ...p, [clave]: e.target.value }))} name={`pref_${clave}`}>
                    <option value="">Sin preferencia</option>
                    {PREFERENCIAS_OPCIONES[clave].map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Campo>
              ))}
              <div className="pc-field pc-field--full" style={{ flexDirection: "row", flexWrap: "wrap", gap: "8px 20px" }}>
                {PREFERENCIAS_BANDERAS.map(({ key, label }) => (
                  <label key={key} style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                    <input type="checkbox" checked={prefs[key]} onChange={(e) => setPrefs((p) => ({ ...p, [key]: e.target.checked }))} name={`pref_${key}`} />
                    {label}
                  </label>
                ))}
                <small className="pc-field__hint" style={{ flexBasis: "100%" }}>
                  Las preferencias se atienden según la disponibilidad; no están garantizadas.
                </small>
              </div>
              <Campo label="Algo que debamos saber" full hint={`${notas.length}/500`}>
                <textarea className="input" rows={3} maxLength={500} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Hora de llegada, cama extra, alergias…" name="notas" />
              </Campo>
            </div>
            {/* Campo trampa: las personas no lo ven; los bots suelen llenarlo. */}
            <div className="rv__trap" aria-hidden="true">
              <label>
                Sitio web
                <input tabIndex={-1} autoComplete="off" value={trampa} onChange={(e) => setTrampa(e.target.value)} name="sitio_web" />
              </label>
            </div>
          </section>

          <section className="pc__card">
            <div className="rv__total">
              <span>
                {elegido.nombre} · {noches} {noches === 1 ? "noche" : "noches"}
              </span>
              <strong>{formatMoney(elegido.precio_total)}</strong>
            </div>
            <label className="pc__consent">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} required name="consentimiento" />
              <span>Autorizo a {hotel?.nombre ?? "el hotel"} a tratar mis datos personales para gestionar esta reserva y contactarme sobre ella.</span>
            </label>
            {error && (
              <p className="pc__error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="pc__submit" disabled={enviando || !consent}>
              {enviando && <Loader2 className="pc__spin" size={16} />} Solicitar reserva
            </button>
          </section>
        </form>
      )}
    </>
  );
}

function Consultar({ hotel }) {
  const [form, setForm] = useState({ codigo: "", documento_identidad: "" });
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [reserva, setReserva] = useState(null);
  const [cancelando, setCancelando] = useState(false);
  const [errorCancelar, setErrorCancelar] = useState("");

  const [pagando, setPagando] = useState(false);
  const [errorPago, setErrorPago] = useState("");

  async function pagar() {
    setErrorPago("");
    setPagando(true);
    try {
      const { url } = await reservasWebApi.pagar(cuerpo());
      recordar(cuerpo().codigo, cuerpo().documento_identidad);
      window.location.assign(url);
    } catch (err) {
      setErrorPago(err.message);
      setPagando(false);
    }
  }

  const cuerpo = () => ({ codigo: form.codigo.trim().toUpperCase(), documento_identidad: form.documento_identidad.trim() });

  async function consultar(e) {
    e.preventDefault();
    setError("");
    setErrorCancelar("");
    setCargando(true);
    try {
      setReserva(await reservasWebApi.consultar(cuerpo()));
    } catch (err) {
      setReserva(null);
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  async function cancelar() {
    setErrorCancelar("");
    setCancelando(true);
    try {
      setReserva(await reservasWebApi.cancelar(cuerpo()));
    } catch (err) {
      setErrorCancelar(err.message);
    } finally {
      setCancelando(false);
    }
  }

  return (
    <>
      <form className="pc__card" onSubmit={consultar}>
        <h2>Consulta tu reserva</h2>
        <p className="pc__help">Escribe el código que recibiste al reservar y el documento del titular.</p>
        <div className="pc-grid">
          <Campo label="Código de reserva" required>
            <input className="input" value={form.codigo} onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))} required minLength={6} maxLength={12} placeholder="HST-XXXXXX" autoComplete="off" name="codigo" />
          </Campo>
          <Campo label="Documento del titular" required>
            <input className="input" value={form.documento_identidad} onChange={(e) => setForm((f) => ({ ...f, documento_identidad: e.target.value }))} required minLength={3} maxLength={30} autoComplete="off" name="documento-consulta" />
          </Campo>
        </div>
        {error && (
          <p className="pc__error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="pc__submit" disabled={cargando}>
          {cargando ? <Loader2 className="pc__spin" size={16} /> : <Search size={16} />} Consultar
        </button>
      </form>
      {reserva && <Resumen r={reserva} hotel={hotel} onCancelar={cancelar} cancelando={cancelando} errorCancelar={errorCancelar} onPagar={pagar} pagando={pagando} errorPago={errorPago} />}
    </>
  );
}

/**
 * Al volver de Wompi (`/reservar?pago=CÓDIGO&id=TRANSACCIÓN`): confirma el pago consultando la transacción.
 * El webhook de Wompi suele confirmarlo antes; esto cubre el caso en que no llegue (p. ej. en desarrollo).
 */
function Retorno({ hotel, codigo, transaccion }) {
  const [documento, setDocumento] = useState(() => recordada(codigo));
  const [estado, setEstado] = useState({ error: "", reserva: null });
  const [intentos, setIntentos] = useState(0);

  useEffect(() => {
    if (!documento) return undefined;
    let activo = true;
    // Sin id de transacción (el huésped volvió sin terminar) solo se consulta el estado de la reserva.
    (transaccion
      ? reservasWebApi.verificarPago({ codigo, documento_identidad: documento, transaccion_id: transaccion })
      : reservasWebApi.consultar({ codigo, documento_identidad: documento })
    )
      .then((reserva) => {
        if (!activo) return;
        setEstado({ error: "", reserva });
        // Pagos por PSE o Nequi pueden tardar unos segundos en aprobarse: se reintenta un rato.
        if (reserva.estado === "pendiente" && Number(reserva.pagado) === 0 && intentos < 6) setTimeout(() => activo && setIntentos((n) => n + 1), 4000);
      })
      .catch((err) => activo && setEstado({ error: err.message, reserva: null }));
    return () => {
      activo = false;
    };
  }, [codigo, documento, transaccion, intentos]);

  const [pagando, setPagando] = useState(false);
  const [errorPago, setErrorPago] = useState("");
  async function pagar() {
    setErrorPago("");
    setPagando(true);
    try {
      const { url } = await reservasWebApi.pagar({ codigo, documento_identidad: documento });
      window.location.assign(url);
    } catch (err) {
      setErrorPago(err.message);
      setPagando(false);
    }
  }

  const [borrador, setBorrador] = useState("");
  if (!documento) {
    return (
      <form
        className="pc__card"
        onSubmit={(e) => {
          e.preventDefault();
          setDocumento(borrador.trim());
        }}
      >
        <h2>Confirma tu pago</h2>
        <p className="pc__help">Para mostrarte el estado de la reserva {codigo}, escribe el documento del titular.</p>
        <Campo label="Documento del titular" required>
          <input className="input" value={borrador} onChange={(e) => setBorrador(e.target.value)} required minLength={3} maxLength={30} autoComplete="off" name="documento-retorno" />
        </Campo>
        <button type="submit" className="pc__submit">
          Ver mi reserva
        </button>
      </form>
    );
  }
  const r = estado.reserva;
  return (
    <>
      <section className={`pc__card pc__state${r && Number(r.pagado) > 0 ? " pc__state--ok" : ""}`} aria-busy={!r && !estado.error}>
        {!r && !estado.error ? (
          <>
            <Loader2 className="pc__spin" size={22} />
            <p>Confirmando tu pago…</p>
          </>
        ) : r && Number(r.pagado) > 0 ? (
          <>
            <CheckCircle2 size={40} strokeWidth={1.5} />
            <h1>¡Pago recibido!</h1>
            <p>Tu reserva {r.codigo} quedó {r.estado === "confirmada" ? "confirmada" : "registrada"}.</p>
          </>
        ) : (
          <>
            <h1>{estado.error ? "No pudimos confirmar tu pago" : "Tu pago aún no aparece aprobado"}</h1>
            <p>{estado.error || "Si pagaste por PSE o Nequi puede tardar unos minutos. Si no se completó, puedes intentarlo de nuevo desde aquí."}</p>
            <button type="button" className="pc__link" onClick={() => setIntentos((n) => n + 1)}>
              Volver a revisar
            </button>
          </>
        )}
      </section>
      {r && <Resumen r={r} hotel={hotel} onPagar={pagar} pagando={pagando} errorPago={errorPago} />}
      <p style={{ textAlign: "center" }}>
        <Link to="/reservar" className="pc__link">
          Hacer otra reserva
        </Link>
      </p>
    </>
  );
}

/**
 * Reserva en línea pública: el huésped busca disponibilidad por tipo de habitación y deja su solicitud.
 * No hay pago en línea; la reserva queda pendiente hasta que el hotel la confirme (routes/reservas_web.py).
 */
export default function ReservarPage() {
  const [hotel, setHotel] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [params] = useSearchParams();
  const [vista, setVista] = useState(params.get("vista") === "consultar" ? "consultar" : "reservar");
  const codigoPago = params.get("pago");
  const transaccion = params.get("id");

  useEffect(() => {
    let active = true;
    reservasWebApi
      .hotel()
      .then((data) => {
        if (!active) return;
        configureFormat({ moneda: data.moneda });
        setHotel(data);
      })
      .catch((err) => active && setLoadError(err.message));
    return () => {
      active = false;
    };
  }, []);

  if (loadError) {
    return (
      <Pantalla>
        <section className="pc__card pc__state">
          <h1>No pudimos cargar la página</h1>
          <p>{loadError}</p>
        </section>
      </Pantalla>
    );
  }
  if (!hotel) {
    return (
      <Pantalla>
        <section className="pc__card pc__state" aria-busy="true">
          <Loader2 className="pc__spin" size={22} />
          <p>Cargando…</p>
        </section>
      </Pantalla>
    );
  }

  return (
    <Pantalla hotel={hotel}>
      <section className="pc__card pc__intro">
        <p className="pc__eyebrow">{[hotel.nombre, hotel.ciudad].filter(Boolean).join(" · ")}</p>
        <h1>Reserva tu estadía</h1>
        <p className="pc__lead">
          Check-in desde las {hotel.hora_checkin} · Check-out hasta las {hotel.hora_checkout}
          {hotel.direccion ? ` · ${hotel.direccion}` : ""}
        </p>
        <div className="rv__tabs" role="tablist">
          <button type="button" role="tab" aria-selected={vista === "reservar"} className={vista === "reservar" ? "on" : ""} onClick={() => setVista("reservar")}>
            Reservar
          </button>
          <button type="button" role="tab" aria-selected={vista === "consultar"} className={vista === "consultar" ? "on" : ""} onClick={() => setVista("consultar")}>
            Consultar mi reserva
          </button>
        </div>
      </section>

      {codigoPago ? (
        <Retorno hotel={hotel} codigo={codigoPago} transaccion={transaccion} />
      ) : vista === "consultar" ? (
        <Consultar hotel={hotel} />
      ) : hotel.reservas_activas ? (
        <Reservar hotel={hotel} />
      ) : (
        <section className="pc__card pc__state">
          <h1>Por ahora no tomamos reservas en línea</h1>
          <Contacto hotel={hotel} extra="Estamos atendiendo las reservas por otros canales." />
          <p>
            <Link to="/" className="pc__link">
              Volver al inicio
            </Link>
          </p>
        </section>
      )}
    </Pantalla>
  );
}
