import { CalendarDays, CheckCircle2, Clock, Loader2, Plus, ShieldCheck, Trash2, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { precheckinApi } from "../api/services";
import Logo from "../components/ui/Logo";
import { formatShortDate } from "../utils/format";
import "../components/ui/ui.css";
import "./PreCheckinPage.css";

const TIPOS_DOCUMENTO = [
  { value: "CC", label: "Cédula de ciudadanía" },
  { value: "CE", label: "Cédula de extranjería" },
  { value: "TI", label: "Tarjeta de identidad" },
  { value: "PA", label: "Pasaporte" },
  { value: "PEP", label: "Permiso especial de permanencia" },
  { value: "OTRO", label: "Otro documento" },
];

const MOTIVOS = [
  { value: "turismo", label: "Turismo" },
  { value: "negocios", label: "Negocios" },
  { value: "familia", label: "Visita a familiares" },
  { value: "salud", label: "Salud" },
  { value: "estudio", label: "Estudio" },
  { value: "otro", label: "Otro" },
];

const PERSONA_VACIA = { tipo_documento: "CC", documento_identidad: "", nombres: "", apellidos: "", nacionalidad: "", fecha_nacimiento: "" };

const hoy = () => new Date().toISOString().slice(0, 10);


function valoresIniciales(info) {
  const previo = info.datos;
  if (previo) {
    return {
      titular: {
        ...PERSONA_VACIA,
        telefono: "",
        email: "",
        ...previo.titular,
        procedencia: previo.titular.procedencia ?? "",
      },
      acompanantes: previo.acompanantes ?? [],
      hora_llegada: (previo.hora_llegada ?? "").slice(0, 5),
      motivo_viaje: previo.motivo_viaje ?? "",
      notas: previo.notas ?? "",
    };
  }
  const t = info.titular;
  return {
    titular: {
      ...PERSONA_VACIA,
      tipo_documento: t.tipo_documento || "CC",
      nombres: t.nombres ?? "",
      apellidos: t.apellidos ?? "",
      nacionalidad: t.nacionalidad ?? "",
      telefono: "",
      email: "",
      procedencia: "",
    },
    acompanantes: [],
    hora_llegada: "",
    motivo_viaje: "",
    notas: "",
  };
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

/** Campos de una persona (titular o acompañante). */
function Persona({ valores, onChange, prefijo }) {
  const set = (campo) => (e) => onChange({ ...valores, [campo]: e.target.value });
  return (
    <div className="pc-grid">
      <Campo label="Tipo de documento" required>
        <select className="input" value={valores.tipo_documento} onChange={set("tipo_documento")} required name={`${prefijo}-tipo`}>
          {TIPOS_DOCUMENTO.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </Campo>
      <Campo label="Número de documento" required>
        <input className="input" value={valores.documento_identidad} onChange={set("documento_identidad")} required minLength={3} maxLength={30} autoComplete="off" name={`${prefijo}-documento`} />
      </Campo>
      <Campo label="Nombres" required>
        <input className="input" value={valores.nombres} onChange={set("nombres")} required maxLength={100} autoComplete="given-name" name={`${prefijo}-nombres`} />
      </Campo>
      <Campo label="Apellidos" required>
        <input className="input" value={valores.apellidos} onChange={set("apellidos")} required maxLength={100} autoComplete="family-name" name={`${prefijo}-apellidos`} />
      </Campo>
      <Campo label="Nacionalidad" required>
        <input className="input" value={valores.nacionalidad} onChange={set("nacionalidad")} required minLength={2} maxLength={60} placeholder="Ej. Colombiana" name={`${prefijo}-nacionalidad`} />
      </Campo>
      <Campo label="Fecha de nacimiento" required>
        <input className="input" type="date" value={valores.fecha_nacimiento} onChange={set("fecha_nacimiento")} required max={hoy()} name={`${prefijo}-nacimiento`} />
      </Campo>
    </div>
  );
}

function Pantalla({ children }) {
  return (
    <main className="pc">
      <header className="pc__brand">
        <Logo size={32} />
        <span>
          hestia<span className="pc__dot">.</span>
        </span>
      </header>
      {children}
      <footer className="pc__footer">Registro previo a la llegada · Tus datos se usan solo para el registro de alojamiento del hotel.</footer>
    </main>
  );
}

export default function PreCheckinPage() {
  const { token } = useParams();
  const [info, setInfo] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [values, setValues] = useState(null);
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    let active = true;
    precheckinApi
      .publicGet(token)
      .then((data) => {
        if (!active) return;
        setInfo(data);
        setValues(valoresIniciales(data));
      })
      .catch((err) => active && setLoadError(err.message));
    return () => {
      active = false;
    };
  }, [token]);

  const maxAcompanantes = info ? Math.max(0, info.num_huespedes - 1) : 0;
  const personas = useMemo(() => (info ? `${info.num_huespedes} ${info.num_huespedes === 1 ? "persona" : "personas"}` : ""), [info]);

  if (loadError) {
    return (
      <Pantalla>
        <section className="pc__card pc__state">
          <h1>No pudimos abrir este enlace</h1>
          <p>{loadError}</p>
        </section>
      </Pantalla>
    );
  }
  if (!info || !values) {
    return (
      <Pantalla>
        <section className="pc__card pc__state" aria-busy="true">
          <Loader2 className="pc__spin" size={22} />
          <p>Cargando tu reserva…</p>
        </section>
      </Pantalla>
    );
  }
  if (info.estado === "validado") {
    return (
      <Pantalla>
        <section className="pc__card pc__state pc__state--ok">
          <CheckCircle2 size={40} strokeWidth={1.5} />
          <h1>Tu registro ya está listo</h1>
          <p>
            {info.hotel_nombre} validó tus datos para la reserva <strong>{info.codigo}</strong>. Te esperamos el {formatShortDate(info.fecha_checkin)}.
          </p>
        </section>
      </Pantalla>
    );
  }
  if (sent) {
    return (
      <Pantalla>
        <section className="pc__card pc__state pc__state--ok">
          <CheckCircle2 size={40} strokeWidth={1.5} />
          <h1>¡Registro enviado!</h1>
          <p>
            Recibimos tus datos para la reserva <strong>{info.codigo}</strong>. El hotel los revisará y te estará esperando el {formatShortDate(info.fecha_checkin)} desde las {info.hora_checkin}.
          </p>
          <button type="button" className="pc__link" onClick={() => setSent(false)}>
            Corregir algún dato
          </button>
        </section>
      </Pantalla>
    );
  }

  const setTitular = (titular) => setValues((v) => ({ ...v, titular }));
  const setAcompanante = (i, persona) => setValues((v) => ({ ...v, acompanantes: v.acompanantes.map((a, j) => (j === i ? persona : a)) }));
  const addAcompanante = () => setValues((v) => ({ ...v, acompanantes: [...v.acompanantes, { ...PERSONA_VACIA, tipo_documento: v.titular.tipo_documento }] }));
  const removeAcompanante = (i) => setValues((v) => ({ ...v, acompanantes: v.acompanantes.filter((_, j) => j !== i) }));

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const respuesta = await precheckinApi.publicSend(token, {
        titular: { ...values.titular, procedencia: values.titular.procedencia.trim() || null },
        acompanantes: values.acompanantes,
        hora_llegada: values.hora_llegada || null,
        motivo_viaje: values.motivo_viaje || null,
        notas: values.notas.trim() || null,
      });
      setInfo(respuesta);
      setSent(true);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Pantalla>
      <section className="pc__card pc__intro">
        <p className="pc__eyebrow">{info.hotel_nombre}</p>
        <h1>Completa tu registro antes de llegar</h1>
        <p className="pc__lead">Así tu llegada es más rápida: en recepción solo confirmaremos tu documento.</p>
        <dl className="pc__summary">
          <div>
            <dt>
              <CalendarDays size={13} /> Estadía
            </dt>
            <dd>
              {formatShortDate(info.fecha_checkin)} → {formatShortDate(info.fecha_checkout)} · {info.noches} {info.noches === 1 ? "noche" : "noches"}
            </dd>
          </div>
          <div>
            <dt>
              <Users size={13} /> Huéspedes
            </dt>
            <dd>{personas}</dd>
          </div>
          <div>
            <dt>
              <ShieldCheck size={13} /> Reserva
            </dt>
            <dd>{info.codigo}</dd>
          </div>
        </dl>
        {info.estado === "completado" && <p className="pc__notice">Ya enviaste tus datos. Puedes corregirlos y volver a enviarlos mientras el hotel no los valide.</p>}
      </section>

      <form onSubmit={handleSubmit} className="pc__form">
        <section className="pc__card">
          <h2>Tus datos</h2>
          <p className="pc__help">Titular de la reserva.</p>
          <Persona valores={values.titular} onChange={setTitular} prefijo="titular" />
          <div className="pc-grid pc-grid--spaced">
            <Campo label="Teléfono móvil" required>
              <input className="input" type="tel" value={values.titular.telefono} onChange={(e) => setTitular({ ...values.titular, telefono: e.target.value })} required minLength={7} maxLength={30} autoComplete="tel" name="titular-telefono" />
            </Campo>
            <Campo label="Correo electrónico" required>
              <input className="input" type="email" value={values.titular.email} onChange={(e) => setTitular({ ...values.titular, email: e.target.value })} required maxLength={150} autoComplete="email" name="titular-email" />
            </Campo>
            <Campo label="Ciudad y país de procedencia" full>
              <input className="input" value={values.titular.procedencia} onChange={(e) => setTitular({ ...values.titular, procedencia: e.target.value })} maxLength={100} placeholder="Ej. Medellín, Colombia" name="titular-procedencia" />
            </Campo>
          </div>
        </section>

        {maxAcompanantes > 0 && (
          <section className="pc__card">
            <h2>Acompañantes</h2>
            <p className="pc__help">
              Tu reserva es para {personas}. Registra a las demás personas (hasta {maxAcompanantes}); si alguien aún no está definido, puedes dejarlo para recepción.
            </p>
            {values.acompanantes.map((persona, i) => (
              <div className="pc__companion" key={i}>
                <div className="pc__companion-head">
                  <strong>Acompañante {i + 1}</strong>
                  <button type="button" className="pc__link pc__link--danger" onClick={() => removeAcompanante(i)}>
                    <Trash2 size={13} /> Quitar
                  </button>
                </div>
                <Persona valores={persona} onChange={(p) => setAcompanante(i, p)} prefijo={`acomp${i}`} />
              </div>
            ))}
            {values.acompanantes.length < maxAcompanantes && (
              <button type="button" className="pc__add" onClick={addAcompanante}>
                <Plus size={15} /> Agregar acompañante
              </button>
            )}
          </section>
        )}

        <section className="pc__card">
          <h2>Tu llegada</h2>
          <div className="pc-grid">
            <Campo label="Hora estimada de llegada" hint={`El check-in es desde las ${info.hora_checkin}.`}>
              <input className="input" type="time" value={values.hora_llegada} onChange={(e) => setValues((v) => ({ ...v, hora_llegada: e.target.value }))} name="hora-llegada" />
            </Campo>
            <Campo label="Motivo del viaje">
              <select className="input" value={values.motivo_viaje} onChange={(e) => setValues((v) => ({ ...v, motivo_viaje: e.target.value }))} name="motivo">
                <option value="">Prefiero no decir</option>
                {MOTIVOS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo label="Algo que debamos saber" full hint={`${values.notas.length}/500`}>
              <textarea className="input" rows={3} maxLength={500} value={values.notas} onChange={(e) => setValues((v) => ({ ...v, notas: e.target.value }))} placeholder="Alergias, cama extra, llegada tardía…" name="notas" />
            </Campo>
          </div>
        </section>

        <section className="pc__card">
          <label className="pc__consent">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} required name="consentimiento" />
            <span>
              Autorizo a {info.hotel_nombre} a tratar mis datos personales y los de mis acompañantes para el registro de alojamiento y la gestión de esta reserva.
            </span>
          </label>
          {error && (
            <p className="pc__error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="pc__submit" disabled={saving || !consent}>
            {saving ? <Loader2 className="pc__spin" size={16} /> : <Clock size={16} />}
            {info.estado === "completado" ? "Enviar de nuevo" : "Enviar registro"}
          </button>
        </section>
      </form>
    </Pantalla>
  );
}
