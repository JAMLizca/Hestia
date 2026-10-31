import { CheckCircle2, Loader2, LogIn, Plus, Search, Trash2, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { cuentaApi, reservasWebApi } from "../api/services";
import { useAuth } from "../context/AuthContext";
import RecomendacionHabitaciones from "../features/inteligencia/RecomendacionHabitaciones";
import { Campo, Contacto, Pantalla, Resumen } from "../features/reservasWeb/Comunes";
import { MOTIVOS, PERSONA_VACIA, Persona } from "../features/reservasWeb/Registro";
import { configureFormat, formatMoney, formatShortDate, nights as contarNoches, todayISO } from "../utils/format";
import { PREFERENCIAS_BANDERAS, PREFERENCIAS_OPCIONES } from "../utils/status";
import "../components/ui/ui.css";
import "./PreCheckinPage.css";
import "./ReservarPage.css";



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

/** Dirección a la que se vuelve tras iniciar sesión: la misma búsqueda, con la habitación ya elegida. */
const volverA = (f, tipo) => {
  const q = new URLSearchParams({ llegada: f.checkin, salida: f.checkout, huespedes: String(f.huespedes) });
  if (tipo) q.set("tipo", String(tipo.tipo_habitacion_id));
  return { pathname: "/reservar", search: `?${q.toString()}` };
};

/** Ver disponibilidad es libre; reservar exige una cuenta de huésped. */
function AccesoParaReservar({ status, esPersonal, logout, volver }) {
  if (status === "loading") {
    return (
      <section className="pc__card pc__state" aria-busy="true">
        <Loader2 className="pc__spin" size={22} />
        <p>Revisando tu sesión…</p>
      </section>
    );
  }
  if (esPersonal) {
    return (
      <section className="pc__card pc__state">
        <h2>Tienes una sesión del personal</h2>
        <p>Las reservas en línea se hacen con una cuenta de huésped. Para registrar una reserva de un cliente, usa el panel.</p>
        <div className="rv__row" style={{ justifyContent: "center" }}>
          <Link to="/reservas" className="rv__btn rv__btn--primary">
            Ir a Reservas
          </Link>
          <button type="button" className="rv__btn" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </section>
    );
  }
  return (
    <section className="pc__card rv__gate">
      <h2>3. Inicia sesión para reservar</h2>
      <p className="pc__help">
        Para reservar necesitas una cuenta. Así tienes tus reservas en un solo lugar y puedes pagarlas, consultarlas o cancelarlas cuando quieras. Tu búsqueda se conserva.
      </p>
      <div className="rv__row">
        <Link to="/login?modo=registro" state={{ from: volver }} className="pc__submit rv__gate-btn">
          <UserPlus size={16} /> Crear cuenta
        </Link>
        <Link to="/login" state={{ from: volver }} className="pc__submit rv__gate-btn rv__cta--sec">
          <LogIn size={16} /> Ya tengo cuenta
        </Link>
      </div>
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
  const { user, status, esCliente, esPersonal, logout } = useAuth();
  const [huesped, setHuesped] = useState({ ...PERSONA_VACIA, email: "", telefono: "", procedencia: "" });
  // Registro de alojamiento (antes era un paso aparte, el pre-check-in): acompañantes y datos de la llegada.
  const [acompanantes, setAcompanantes] = useState([]);
  const [llegada, setLlegada] = useState({ hora_llegada: "", motivo_viaje: "" });
  // Con la cuenta iniciada, los datos de contacto se rellenan solos (se pueden cambiar: el titular puede ser otra persona).
  useEffect(() => {
    if (!esCliente) return;
    setHuesped((h) => ({ ...h, nombres: h.nombres || user.nombres, apellidos: h.apellidos || user.apellidos, email: h.email || user.email }));
  }, [esCliente, user]);
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
  const maxAcompanantes = Math.max(0, Number(fechas.huespedes) - 1);
  const [pagando, setPagando] = useState(false);
  const [errorPago, setErrorPago] = useState("");

  async function pagar() {
    setErrorPago("");
    setPagando(true);
    try {
      const { url } = await cuentaApi.pagar(reserva.codigo);
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
        huesped: { ...huesped, procedencia: huesped.procedencia.trim() || null },
        acompanantes: acompanantes.slice(0, Math.max(0, Number(fechas.huespedes) - 1)),
        hora_llegada: llegada.hora_llegada || null,
        motivo_viaje: llegada.motivo_viaje || null,
        notas: notas.trim() || null,
        preferencias: preferenciasEnvio(prefs),
        sitio_web: trampa || null,
      });
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
          <h1>¡Recibimos tu reserva y tu registro!</h1>
          <p>
            Ya no tienes que completar nada más antes de llegar. Guarda tu código: también la encuentras siempre en{" "}
            <Link to="/mis-reservas" className="pc__link">
              Mis reservas
            </Link>
            .
          </p>
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
            <>
            <RecomendacionHabitaciones
              variante="huesped"
              contexto={{ llegada: fechas.checkin, salida: fechas.checkout, huespedes: Number(fechas.huespedes) }}
              preferencias={prefs}
              onPreferencias={setPrefs}
              seleccionada={elegido?.tipo_habitacion_id}
              onElegir={(s) => setElegido(tipos.find((t) => t.tipo_habitacion_id === s.tipo_habitacion_id) ?? null)}
            />
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
            </>
          )}
        </section>
      )}

      {tipos && elegido && !esCliente && (
        <AccesoParaReservar status={status} esPersonal={esPersonal} logout={logout} volver={volverA(fechas, elegido)} />
      )}

      {tipos && elegido && esCliente && (
        <form className="pc__form" onSubmit={enviar}>
          <section className="pc__card">
            <h2>3. Tus datos y tu registro</h2>
            <p className="pc__help">
              Titular de la reserva. Con estos datos queda hecho tu registro de alojamiento: en recepción solo confirmaremos tu documento.{" "}
              {hotel.pagos_activos
                ? `Al terminar podrás pagar un anticipo del ${hotel.anticipo_porcentaje}% para asegurar tu habitación; el resto se paga en el hotel.`
                : "El hotel la confirmará contigo; no se cobra nada en línea."}
            </p>
            <Persona valores={huesped} onChange={(p) => setHuesped((h) => ({ ...h, ...p }))} prefijo="titular" />
            <div className="pc-grid pc-grid--spaced">
              <Campo label="Correo electrónico" required>
                <input className="input" type="email" value={huesped.email} onChange={setH("email")} required maxLength={150} autoComplete="email" name="email" />
              </Campo>
              <Campo label="Teléfono móvil" required>
                <input className="input" type="tel" value={huesped.telefono} onChange={setH("telefono")} required minLength={7} maxLength={30} autoComplete="tel" name="telefono" />
              </Campo>
              <Campo label="Ciudad y país de procedencia" full>
                <input className="input" value={huesped.procedencia} onChange={setH("procedencia")} maxLength={100} placeholder="Ej. Medellín, Colombia" name="procedencia" />
              </Campo>
            </div>
          </section>

          {maxAcompanantes > 0 && (
            <section className="pc__card">
              <h2>Acompañantes</h2>
              <p className="pc__help">
                Tu reserva es para {fechas.huespedes} personas. Registra a las demás (hasta {maxAcompanantes}); si alguien aún no está definido, puedes dejarlo para recepción.
              </p>
              {acompanantes.slice(0, maxAcompanantes).map((persona, i) => (
                <div className="pc__companion" key={i}>
                  <div className="pc__companion-head">
                    <strong>Acompañante {i + 1}</strong>
                    <button type="button" className="pc__link pc__link--danger" onClick={() => setAcompanantes((l) => l.filter((_, k) => k !== i))}>
                      <Trash2 size={13} /> Quitar
                    </button>
                  </div>
                  <Persona valores={persona} onChange={(p) => setAcompanantes((l) => l.map((x, k) => (k === i ? p : x)))} prefijo={`acomp${i}`} />
                </div>
              ))}
              {acompanantes.length < maxAcompanantes && (
                <button type="button" className="pc__add" onClick={() => setAcompanantes((l) => [...l, { ...PERSONA_VACIA, tipo_documento: huesped.tipo_documento }])}>
                  <Plus size={15} /> Agregar acompañante
                </button>
              )}
            </section>
          )}

          <section className="pc__card">
            <h2>Tu llegada</h2>
            <div className="pc-grid">
              <Campo label="Hora estimada de llegada" hint={`El check-in es desde las ${hotel.hora_checkin}.`}>
                <input className="input" type="time" value={llegada.hora_llegada} onChange={(e) => setLlegada((l) => ({ ...l, hora_llegada: e.target.value }))} name="hora-llegada" />
              </Campo>
              <Campo label="Motivo del viaje">
                <select className="input" value={llegada.motivo_viaje} onChange={(e) => setLlegada((l) => ({ ...l, motivo_viaje: e.target.value }))} name="motivo">
                  <option value="">Prefiero no decir</option>
                  {MOTIVOS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
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
                <textarea className="input" rows={3} maxLength={500} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Cama extra, alergias, celebración…" name="notas" />
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
              <span>Autorizo a {hotel?.nombre ?? "el hotel"} a tratar mis datos personales y los de mis acompañantes para el registro de alojamiento y la gestión de esta reserva.</span>
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
  const { status, esCliente } = useAuth();
  const [documento, setDocumento] = useState(() => recordada(codigo));
  const [estado, setEstado] = useState({ error: "", reserva: null });
  const [intentos, setIntentos] = useState(0);
  // Con la cuenta iniciada no hace falta el documento: la reserva se identifica por la cuenta.
  const listo = esCliente || Boolean(documento);

  useEffect(() => {
    if (!listo) return undefined;
    let activo = true;
    // Sin id de transacción (el huésped volvió sin terminar) solo se consulta el estado de la reserva.
    (esCliente
      ? transaccion
        ? cuentaApi.verificarPago(codigo, transaccion)
        : cuentaApi.reservas().then((lista) => lista.find((x) => x.codigo === codigo) ?? Promise.reject(new Error("No encontramos esa reserva en tu cuenta.")))
      : transaccion
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
  }, [codigo, documento, transaccion, intentos, esCliente, listo]);

  const [pagando, setPagando] = useState(false);
  const [errorPago, setErrorPago] = useState("");
  async function pagar() {
    setErrorPago("");
    setPagando(true);
    try {
      const { url } = esCliente ? await cuentaApi.pagar(codigo) : await reservasWebApi.pagar({ codigo, documento_identidad: documento });
      window.location.assign(url);
    } catch (err) {
      setErrorPago(err.message);
      setPagando(false);
    }
  }

  const [borrador, setBorrador] = useState("");
  if (status === "loading") {
    return (
      <section className="pc__card pc__state" aria-busy="true">
        <Loader2 className="pc__spin" size={22} />
        <p>Cargando…</p>
      </section>
    );
  }
  if (!listo) {
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
        <Link to={esCliente ? "/mis-reservas" : "/reservar"} className="pc__link">
          {esCliente ? "Ver mis reservas" : "Hacer otra reserva"}
        </Link>
      </p>
    </>
  );
}

/**
 * Reserva en línea pública: cualquiera puede buscar disponibilidad por tipo de habitación, pero para reservar hay que
 * iniciar sesión con una cuenta de huésped. La reserva queda pendiente hasta que se paga el anticipo o el hotel la
 * confirma (routes/reservas_web.py).
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
          Reserva y registro en un solo paso: así tu llegada es más rápida. Check-in desde las {hotel.hora_checkin} · Check-out hasta las {hotel.hora_checkout}
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
