import {
  ArrowRight,
  BedDouble,
  BrainCircuit,
  CalendarDays,
  Check,
  ConciergeBell,
  Eye,
  Layers,
  Menu,
  ShieldCheck,
  TrendingUp,
  Users,
  Workflow,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import arquitectura from "../assets/arquitectura-hestia.webp";
import logoCompleto from "../assets/logo-hestia-completo.webp";
import Logo from "../components/ui/Logo";
import { useAuth } from "../context/AuthContext";
import "./LandingPage.css";

const CURRENT_YEAR = new Date().getFullYear();

/* Contenido tomado textualmente del mockup de la landing (Figma 1). */
const NAV = [
  { href: "#inicio", label: "Inicio" },
  { href: "#plataforma", label: "Plataforma" },
  { href: "#funcionalidades", label: "Funcionalidades" },
  { href: "#inteligencia", label: "Inteligencia" },
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#nosotros", label: "Nosotros" },
];

const MODULOS = ["Reservas", "Habitaciones", "Huéspedes", "Servicios"];

const FUNCIONALIDADES = [
  { icon: BedDouble, title: "Habitaciones", text: "Gestiona habitaciones, tipos y estados. Consulta disponibilidad en tiempo real desde un panel unificado." },
  { icon: CalendarDays, title: "Reservas", text: "Administra reservas, fechas de entrada, salida y disponibilidad. Visualiza el calendario de ocupación." },
  { icon: Users, title: "Huéspedes", text: "Centraliza la información de cada huésped: historial de estadías, datos de contacto y preferencias." },
  { icon: ConciergeBell, title: "Servicios", text: "Gestiona los servicios asociados a las reservas, desde desayuno hasta traslados, todo controlado." },
  { icon: ShieldCheck, title: "Usuarios y roles", text: "Controla el acceso según las responsabilidades de cada usuario con permisos granulares por rol." },
];

const MODELOS = [
  {
    tag: "IA 01",
    kicker: "Modelo 01",
    title: "Predictor de Ocupación",
    text: "Analiza el histórico de reservas y patrones estacionales para estimar el porcentaje de ocupación en los próximos días. Permite anticipar periodos de alta o baja demanda.",
    entrada: ["Historial de reservas", "Fechas de entrada y salida", "Temporadas y días de la semana", "Servicios contratados"],
    salida: "Pronóstico de ocupación para los próximos 14 días con nivel de confianza.",
    chart: "bars",
  },
  {
    tag: "IA 02",
    kicker: "Modelo 02",
    title: "Segmentación de Huéspedes",
    text: "Agrupa a los huéspedes en perfiles según su comportamiento, tipo de estadía y servicios utilizados. Permite conocer mejor al cliente y personalizar la gestión.",
    entrada: ["Datos de huéspedes", "Tipo y duración de estadía", "Servicios utilizados", "Frecuencia de visitas"],
    salida: "Segmentos de huéspedes con características comunes e indicadores por perfil.",
    chart: "segments",
  },
];

// Ilustraciones del mockup (no son datos del hotel).
const BARRAS_14_DIAS = [1, 1, 2, 2, 3, 3, 3, 3, 2, 2, 1, 1, 1, 2];
const ALTURAS_14_DIAS = [48, 55, 62, 68, 86, 92, 95, 88, 74, 66, 52, 50, 57, 70];
const SEGMENTOS = [
  { label: "Viajero de negocios", pct: 38 },
  { label: "Turista familiar", pct: 29 },
  { label: "Escapada de pareja", pct: 21 },
  { label: "Otros", pct: 12 },
];

const IA_INTEGRADA = [
  "Predicciones de ocupación visibles en el dashboard",
  "Segmentos de huéspedes al crear reservas",
  "Alertas automáticas en periodos de alta demanda",
  "Indicadores IA en el módulo de análisis",
];

const POR_QUE = [
  { icon: Layers, title: "Centralización", text: "Toda la información del establecimiento en un único sistema, sin herramientas fragmentadas." },
  { icon: Eye, title: "Visibilidad", text: "Conoce el estado real de la operación en todo momento, desde reservas hasta indicadores." },
  { icon: Workflow, title: "Automatización", text: "Reduce las tareas manuales y los errores con flujos de trabajo estructurados." },
  { icon: BrainCircuit, title: "Inteligencia", text: "Dos modelos de IA que transforman los datos operativos en información accionable." },
  { icon: TrendingUp, title: "Escalabilidad", text: "Arquitectura preparada para incorporar nuevas funcionalidades sin perder estabilidad." },
];

const PASOS = [
  { n: "01", title: "Registra", text: "Hestia recibe y organiza la información del establecimiento: habitaciones, usuarios, roles y servicios." },
  { n: "02", title: "Gestiona", text: "Administra reservas, habitaciones, huéspedes y servicios desde un único panel." },
  { n: "03", title: "Analiza", text: "Los datos son procesados y utilizados por los modelos de IA integrados en la plataforma." },
  { n: "04", title: "Decide", text: "Hestia presenta información útil e indicadores para apoyar la toma de decisiones estratégicas." },
];

function Eyebrow({ children, dark }) {
  return (
    <span className={`lp-eyebrow${dark ? " lp-eyebrow--dark" : ""}`}>
      <span className="lp-eyebrow__dot" />
      {children}
    </span>
  );
}

export default function LandingPage() {
  const { status } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const loggedIn = status === "authenticated";
  const accessTo = loggedIn ? "/dashboard" : "/login";
  const accessLabel = loggedIn ? "Ir al panel" : "Iniciar sesión";

  return (
    <div className="landing">
      {/* ── Navegación ─────────────────────────────── */}
      <nav className="lp-nav">
        <div className="lp-container lp-nav__inner">
          <a href="#inicio" className="lp-nav__logo" aria-label="Hestia — inicio">
            <img src={logoCompleto} alt="Hestia — Sistema Inteligente de Gestión Hotelera" />
          </a>
          <div className={`lp-nav__links${menuOpen ? " lp-nav__links--open" : ""}`}>
            {NAV.map((item) => (
              <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>
                {item.label}
              </a>
            ))}
            <Link to={accessTo} className="lp-btn lp-btn--nav">
              {accessLabel}
            </Link>
          </div>
          <button type="button" className="lp-nav__toggle" onClick={() => setMenuOpen((v) => !v)} aria-label="Abrir menú" aria-expanded={menuOpen}>
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────── */}
      <section id="inicio" className="lp-hero">
        <div className="lp-container lp-hero__grid">
          <div>
            <Eyebrow>Sistema Inteligente de Gestión Hotelera</Eyebrow>
            <h1 className="lp-hero__title">
              Gestión hotelera inteligente, <em>desde un solo lugar.</em>
            </h1>
            <p className="lp-hero__text">
              Hestia centraliza la operación de tu establecimiento y utiliza inteligencia artificial para transformar los datos en
              información útil para la toma de decisiones.
            </p>
            <div className="lp-actions">
              <a href="#funcionalidades" className="lp-btn lp-btn--primary">
                Conocer Hestia <ArrowRight size={17} />
              </a>
              <Link to={accessTo} className="lp-btn lp-btn--outline">
                {accessLabel}
              </Link>
            </div>
            <div className="lp-checks">
              {["Gestión centralizada", "Modelos de IA integrados", "Acceso por roles"].map((t) => (
                <span key={t} className="lp-check">
                  <span className="lp-check__icon">
                    <Check size={11} strokeWidth={3} />
                  </span>
                  {t}
                </span>
              ))}
            </div>
          </div>
          <HeroMockup />
        </div>
      </section>

      {/* ── El problema ────────────────────────────── */}
      <section id="plataforma" className="lp-section lp-section--white">
        <div className="lp-container lp-center" style={{ maxWidth: 1000 }}>
          <Eyebrow>El problema</Eyebrow>
          <h2 className="lp-h2">La gestión hotelera genera datos todos los días. Hestia les da sentido.</h2>
          <p className="lp-lead">Sin las herramientas adecuadas, la información queda dispersa y la operación se vuelve difícil de controlar.</p>
          <div className="lp-flow">
            <div className="lp-pills">
              {MODULOS.map((m) => (
                <span key={m} className="lp-pill">
                  {m}
                </span>
              ))}
            </div>
            <span className="lp-flow__line" style={{ background: "linear-gradient(#ddd4c8, #c9a84c)" }} />
            <div className="lp-scatter">
              <div className="lp-scatter__title">Datos dispersos</div>
              {["Dificultad para analizar", "Tiempo perdido en tareas manuales", "Decisiones basadas solo en experiencia"].map((t) => (
                <div key={t} className="lp-bullet">
                  <span />
                  {t}
                </div>
              ))}
            </div>
            <span className="lp-flow__line" style={{ background: "linear-gradient(#c9a84c, #1e2d4a)" }} />
            <div className="lp-solution">
              <div className="lp-solution__title">HESTIA</div>
              <div className="lp-solution__text">Información centralizada + Inteligencia Artificial</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Funcionalidades ────────────────────────── */}
      <section id="funcionalidades" className="lp-section lp-section--cream">
        <div className="lp-container">
          <div className="lp-center">
            <Eyebrow>Funcionalidades</Eyebrow>
            <h2 className="lp-h2">Todo lo que necesitas para gestionar tu operación.</h2>
          </div>
          <div className="lp-features">
            {FUNCIONALIDADES.map(({ icon: Icon, title, text }) => (
              <article key={title} className="lp-card">
                <span className="lp-card__icon">
                  <Icon size={20} strokeWidth={1.75} />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Inteligencia artificial ────────────────── */}
      <section id="inteligencia" className="lp-section lp-section--deep">
        <div className="lp-container lp-center" style={{ maxWidth: 1100 }}>
          <Eyebrow dark>Inteligencia Artificial</Eyebrow>
          <h2 className="lp-h2 lp-h2--light">La inteligencia detrás de Hestia.</h2>
          <p className="lp-lead lp-lead--light">
            Dos modelos de inteligencia artificial convierten los datos operativos del hotel en información que puede apoyar la toma de
            decisiones.
          </p>
          <div className="lp-flow">
            <div className="lp-pills">
              {MODULOS.map((m) => (
                <span key={m} className="lp-pill lp-pill--gold">
                  {m}
                </span>
              ))}
            </div>
            <span className="lp-flow__line" style={{ background: "linear-gradient(rgba(201,168,76,.38), #c9a84c)" }} />
            <div className="lp-layer">Capa de datos Hestia</div>
            <span className="lp-flow__line" style={{ background: "#c9a84c" }} />
            <div className="lp-models">
              <div className="lp-model-box">
                <div className="lp-model-box__kicker">MODELO 01</div>
                <div className="lp-model-box__title">Predictor de Ocupación</div>
              </div>
              <div className="lp-model-box lp-model-box--alt">
                <div className="lp-model-box__kicker">MODELO 02</div>
                <div className="lp-model-box__title">Segmentación de Huéspedes</div>
              </div>
            </div>
            <span className="lp-flow__line" style={{ background: "#c9a84c" }} />
            <div className="lp-outcome">
              <span className="lp-outcome__gold">Información Inteligente</span>
              <span className="lp-outcome__arrow" />
              <span className="lp-outcome__light">Toma de Decisiones</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Modelos de IA ──────────────────────────── */}
      <section className="lp-section lp-section--cream">
        <div className="lp-container" style={{ maxWidth: 1100 }}>
          <div className="lp-center">
            <Eyebrow>Modelos de IA</Eyebrow>
            <h2 className="lp-h2">Dos modelos. Dos capacidades.</h2>
          </div>
          <div className="lp-two">
            {MODELOS.map((m) => (
              <article key={m.tag} className="lp-model">
                <div className="lp-model__head">
                  <span className="lp-model__tag">{m.tag}</span>
                  <div>
                    <div className="lp-model__kicker">{m.kicker}</div>
                    <h3>{m.title}</h3>
                  </div>
                </div>
                <p className="lp-model__text">{m.text}</p>
                <div className="lp-pipeline">
                  <div className="lp-pipeline__box">
                    <div className="lp-pipeline__label">Entrada</div>
                    {m.entrada.map((e) => (
                      <div key={e} className="lp-bullet lp-bullet--sm">
                        <span />
                        {e}
                      </div>
                    ))}
                  </div>
                  <div className="lp-pipeline__process">PROCESAMIENTO · MODELO IA</div>
                  <div className="lp-pipeline__box lp-pipeline__box--out">
                    <div className="lp-pipeline__label">Salida</div>
                    <div className="lp-pipeline__out">{m.salida}</div>
                  </div>
                </div>
                {m.chart === "bars" ? (
                  <div className="lp-mini">
                    <div className="lp-mini__title">Ocupación predicha — próximos 14 días</div>
                    <div className="lp-bars" aria-hidden="true">
                      {ALTURAS_14_DIAS.map((h, i) => (
                        <span key={i} style={{ height: `${h}%`, background: ["#f0dca0", "#dbbe75", "#c9a84c"][BARRAS_14_DIAS[i] - 1] }} />
                      ))}
                    </div>
                    <div className="lp-mini__axis">
                      <span>Hoy</span>
                      <span className="lp-mini__alert">Alta demanda ≥85%</span>
                      <span>+14d</span>
                    </div>
                  </div>
                ) : (
                  <div className="lp-mini">
                    <div className="lp-mini__title">Distribución de segmentos</div>
                    {SEGMENTOS.map((s) => (
                      <div key={s.label} className="lp-segment">
                        <div className="lp-segment__row">
                          <span>{s.label}</span>
                          <strong>{s.pct}%</strong>
                        </div>
                        <div className="lp-segment__track">
                          <span style={{ width: `${s.pct * 2}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── IA integrada ───────────────────────────── */}
      <section className="lp-section lp-section--white">
        <div className="lp-container lp-split" style={{ maxWidth: 1100 }}>
          <div>
            <Eyebrow>IA integrada</Eyebrow>
            <h2 className="lp-h2 lp-left">La IA no está separada del sistema.</h2>
            <p className="lp-lead lp-left">
              Los resultados de los modelos de inteligencia artificial aparecen directamente dentro del flujo de gestión, en tiempo real,
              donde el administrador los necesita.
            </p>
            <div className="lp-list">
              {IA_INTEGRADA.map((t) => (
                <div key={t} className="lp-check lp-check--lg">
                  <span className="lp-check__icon">
                    <Check size={12} strokeWidth={3} />
                  </span>
                  {t}
                </div>
              ))}
            </div>
          </div>
          <div className="lp-intel" aria-hidden="true">
            <div className="lp-intel__head">
              <span className="lp-eyebrow__dot" />
              HESTIA INTELLIGENCE
            </div>
            <div className="lp-intel__body">
              <div className="lp-intel__card lp-intel__card--gold">
                <div className="lp-intel__kicker">PREDICTOR DE OCUPACIÓN</div>
                <div className="lp-intel__big">82%</div>
                <div className="lp-intel__small">Ocupación predicha mañana</div>
                <span className="lp-intel__tag">Alta demanda</span>
              </div>
              <div className="lp-intel__card">
                <div className="lp-intel__kicker">SEGMENTACIÓN DE HUÉSPEDES</div>
                {SEGMENTOS.slice(0, 3).map((s) => (
                  <div key={s.label} className="lp-segment lp-segment--dark">
                    <div className="lp-segment__row">
                      <span>{s.label}</span>
                      <strong>{s.pct}%</strong>
                    </div>
                    <div className="lp-segment__track">
                      <span style={{ width: `${s.pct * 2}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="lp-intel__alert">⚡ Alta demanda el fin de semana — revisar disponibilidad</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── ¿Por qué Hestia? ───────────────────────── */}
      <section className="lp-section lp-section--cream">
        <div className="lp-container lp-split lp-split--why" style={{ maxWidth: 1100 }}>
          <div>
            <Eyebrow>¿Por qué Hestia?</Eyebrow>
            <h2 className="lp-h2 lp-h2--sm lp-left">
              Más que gestionar. <em>Entender la operación.</em>
            </h2>
            <p className="lp-lead lp-left" style={{ fontSize: 15 }}>
              Hestia elimina la complejidad para que puedas enfocarte en lo que realmente importa: tu establecimiento y tus huéspedes.
            </p>
          </div>
          <div className="lp-why">
            {POR_QUE.map(({ icon: Icon, title, text }) => (
              <article key={title} className="lp-card lp-card--sm">
                <span className="lp-card__icon lp-card__icon--soft">
                  <Icon size={20} strokeWidth={1.75} />
                </span>
                <h4>{title}</h4>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Cómo funciona ──────────────────────────── */}
      <section id="como-funciona" className="lp-section lp-section--white">
        <div className="lp-container" style={{ maxWidth: 1100 }}>
          <div className="lp-center">
            <Eyebrow>Cómo funciona</Eyebrow>
            <h2 className="lp-h2">Cuatro pasos para gestionar mejor.</h2>
          </div>
          <div className="lp-steps">
            <span className="lp-steps__line" />
            {PASOS.map((p, i) => (
              <div key={p.n} className="lp-step">
                <span className={`lp-step__num${i >= 2 ? " lp-step__num--gold" : ""}`}>{p.n}</span>
                <h3>{p.title}</h3>
                <p>{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Arquitectura ───────────────────────────── */}
      <section className="lp-section lp-section--cream">
        <div className="lp-container lp-center" style={{ maxWidth: 1100 }}>
          <Eyebrow>Arquitectura</Eyebrow>
          <h2 className="lp-h2">Tecnología que impulsa Hestia.</h2>
          <p className="lp-lead" style={{ maxWidth: 480, fontSize: 15 }}>
            Una arquitectura moderna y escalable que conecta el frontend con los modelos de inteligencia artificial en el backend.
          </p>
          <figure className="lp-architecture">
            <img
              src={arquitectura}
              alt="Arquitectura de Hestia: cliente web en React que se comunica por HTTP/JSON con la API REST en Python (autenticación, gestión hotelera y servicios), base de datos MySQL y módulo de Machine Learning con modelos de recomendación y predicción."
              loading="lazy"
            />
          </figure>
        </div>
      </section>

      {/* ── Nosotros ───────────────────────────────── */}
      <section id="nosotros" className="lp-section lp-section--white">
        <div className="lp-container" style={{ maxWidth: 900 }}>
          <div className="lp-about">
            <Eyebrow dark>Nosotros</Eyebrow>
            <h2 className="lp-h2 lp-h2--sm lp-h2--light">¿Qué es Hestia?</h2>
            <p className="lp-lead lp-lead--light">
              Hestia es una plataforma web orientada a modernizar la gestión de establecimientos hoteleros mediante la centralización de sus
              procesos operativos y la incorporación de inteligencia artificial para aprovechar sus datos.
            </p>
            <div className="lp-pills">
              {["Software", "Gestión", "Datos", "IA"].map((t) => (
                <span key={t} className="lp-pill lp-pill--serif">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────── */}
      <section id="contacto" className="lp-cta">
        <div className="lp-container lp-center" style={{ maxWidth: 700 }}>
          <Logo size={72} />
          <h2 className="lp-cta__title">Convierte los datos de tu hotel en decisiones más inteligentes.</h2>
          <p className="lp-cta__text">Gestiona, analiza y comprende tu operación desde una sola plataforma.</p>
          <div className="lp-actions lp-actions--center">
            <a href="#plataforma" className="lp-btn lp-btn--gold">
              Conocer la plataforma <ArrowRight size={17} />
            </a>
            <Link to={accessTo} className="lp-btn lp-btn--ghost">
              {accessLabel}
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────── */}
      <footer className="lp-footer">
        <div className="lp-container">
          <div className="lp-footer__grid">
            <div>
              <div className="lp-footer__logo">
                <img src={logoCompleto} alt="Hestia — Gestión hotelera" />
              </div>
              <p className="lp-footer__text">Plataforma web para la gestión centralizada e inteligente de establecimientos hoteleros.</p>
            </div>
            <div className="lp-footer__links">
              {[...NAV.filter((n) => n.label !== "Cómo funciona"), { href: "#contacto", label: "Contacto" }].map((item) => (
                <a key={item.href} href={item.href}>
                  {item.label}
                </a>
              ))}
            </div>
          </div>
          <div className="lp-footer__bottom">
            <p>© {CURRENT_YEAR} Hestia. Sistema Inteligente de Gestión Hotelera.</p>
            <p className="lp-footer__motto">Hospitalidad que inspira, experiencias que perduran.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

/** Vista previa ilustrativa del panel (como en el mockup del hero). */
function HeroMockup() {
  const menu = ["Dashboard", "Reservas", "Habitaciones", "Huéspedes", "Servicios", "Usuarios", "Inteligencia"];
  const kpis = [
    { label: "Reservas hoy", value: "11", color: "#1e2d4a" },
    { label: "Ocupación", value: "74%", color: "#c9a84c" },
    { label: "Disponibles", value: "6", color: "#4a7c59" },
    { label: "Huéspedes", value: "38", color: "#2a3d62" },
  ];
  const semana = [50, 62, 58, 72, 80, 92, 76];
  const rooms = [
    ["101", "#ede5d8"],
    ["102", "#fdf3d7"],
    ["201", "#ede5d8"],
    ["202", "#fdf3d7"],
    ["203", "#1e2d4a"],
    ["301", "#fdf3d7"],
  ];
  return (
    <div className="lp-mock" aria-hidden="true">
      <div className="lp-mock__glow" />
      <div className="lp-mock__window">
        <div className="lp-mock__bar">
          <span style={{ background: "#fc5858" }} />
          <span style={{ background: "#fbbf24" }} />
          <span style={{ background: "#34d399" }} />
          <div className="lp-mock__url">🔒 hestia.app/dashboard</div>
        </div>
        <div className="lp-mock__app">
          <div className="lp-mock__side">
            <div className="lp-mock__brand">
              HESTIA
              <small>Gestión Hotelera</small>
            </div>
            {menu.map((m, i) => (
              <div key={m} className={`lp-mock__item${i === 0 ? " lp-mock__item--active" : ""}`}>
                {m}
              </div>
            ))}
          </div>
          <div className="lp-mock__main">
            <div className="lp-mock__kpis">
              {kpis.map((k) => (
                <div key={k.label} className="lp-mock__kpi">
                  <span>{k.label}</span>
                  <strong style={{ color: k.color }}>{k.value}</strong>
                </div>
              ))}
            </div>
            <div className="lp-mock__row">
              <div className="lp-mock__panel">
                <span className="lp-mock__panel-title">Ocupación semanal</span>
                <div className="lp-mock__bars">
                  {semana.map((h, i) => (
                    <span key={i} style={{ height: `${h}%`, opacity: i === 5 ? 1 : 0.45 }} />
                  ))}
                </div>
              </div>
              <div className="lp-mock__panel">
                <span className="lp-mock__panel-title">Estado habitaciones</span>
                <div className="lp-mock__rooms">
                  {rooms.map(([n, bg]) => (
                    <span key={n} style={{ background: bg, color: bg === "#1e2d4a" ? "#f5f0e8" : "#1e2d4a" }}>
                      {n}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="lp-mock__intel">
              <strong>HESTIA INTELLIGENCE</strong>
              <span>
                Ocupación predicha mañana: <b>82%</b> · Segmento principal: <b>Viajero de negocios</b>
              </span>
            </div>
            <div className="lp-mock__table">
              <span className="lp-mock__panel-title">Reservas recientes</span>
              {[
                ["María García", "201", "27 ago", "Confirmada"],
                ["Carlos Romero", "102", "28 ago", "En curso"],
                ["Ana López", "301", "29 ago", "Pendiente"],
              ].map(([n, h, f, e]) => (
                <div key={n} className="lp-mock__tr">
                  <span>{n}</span>
                  <span>{h}</span>
                  <span>{f}</span>
                  <em>{e}</em>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
