import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import logoCompleto from "../assets/logo-hestia-completo.webp";
import Logo from "../components/ui/Logo";
import { useAuth } from "../context/AuthContext";
import "./LoginPage.css";

const CURRENT_YEAR = new Date().getFullYear();

/** Una dirección "/ruta?consulta" a partir de lo que dejó guardado la pantalla anterior (location o { pathname, search }). */
const aRuta = (from) => (from?.pathname ? `${from.pathname}${from.search ?? ""}` : "");

/**
 * Acceso único: el personal entra al panel y los huéspedes vuelven a donde estaban (o a la página principal).
 * Quien no tiene cuenta de huésped puede crearla aquí mismo (`?modo=registro`).
 */
export default function LoginPage() {
  const { login, register, status, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const registro = params.get("modo") === "registro";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const volver = aRuta(location.state?.from);
  const destinoPersonal = location.state?.from?.pathname || "/dashboard";
  const destinoHuesped = volver || "/";
  const vieneDeReservar = volver.startsWith("/reservar");
  if (status === "authenticated") return <Navigate to={user?.tipo === "cliente" ? destinoHuesped : destinoPersonal} replace />;

  function cambiarModo(nuevo) {
    setError("");
    setPassword("");
    setConfirmar("");
    setParams(nuevo ? { modo: "registro" } : {}, { replace: true, state: location.state });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (registro) {
      if (password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");
      if (password !== confirmar) return setError("Las contraseñas no coinciden.");
    }
    setSubmitting(true);
    try {
      const tipo = registro
        ? await register({ nombres: nombres.trim(), apellidos: apellidos.trim(), email: email.trim(), password })
        : await login(email.trim(), password);
      navigate(tipo === "cliente" ? destinoHuesped : destinoPersonal, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login">
      <section className="login__hero" aria-hidden="true">
        <div className="login__rings" />
        <div className="login__brand">
          <Logo size={28} />
          <span>
            hestia<span className="login__dot">.</span>
          </span>
        </div>

        <div className="login__hero-copy">
          <p className="login__eyebrow">Hospitalidad, con intención</p>
          <h2 className="login__headline">
            La calma de tenerlo todo <span>bajo control.</span>
          </h2>
          <p className="login__lead">Un espacio para cuidar cada detalle de la experiencia de tus huéspedes.</p>
        </div>

        <div className="login__step">
          <span>01</span>
          <span className="login__step-line" />
          <span>Gestión hotelera</span>
        </div>
      </section>

      <section className="login__panel">
        <Link to="/" className="login__back">
          <ArrowLeft size={15} /> Volver al inicio
        </Link>
        <div className="login__form-wrap">
          <div className="login__logo-card">
            <img src={logoCompleto} alt="Hestia — Gestión hotelera" />
          </div>

          <p className="login__eyebrow">{registro ? "Únete a Hestia" : "Bienvenido de nuevo"}</p>
          <h1 className="login__title">{registro ? "Crea tu cuenta" : "Inicia sesión"}</h1>
          <p className="login__subtitle">
            {registro
              ? "Con tu cuenta reservas en línea y gestionas tus reservas."
              : vieneDeReservar
                ? "Inicia sesión para continuar con tu reserva."
                : "Ingresa tus datos para continuar."}
          </p>

          <form className="login__form" onSubmit={handleSubmit} noValidate>
            {registro && (
              <div className="login__row">
                <label className="login__field">
                  <span>Nombres</span>
                  <input type="text" autoComplete="given-name" maxLength={100} value={nombres} onChange={(e) => setNombres(e.target.value)} required />
                </label>
                <label className="login__field">
                  <span>Apellidos</span>
                  <input type="text" autoComplete="family-name" maxLength={100} value={apellidos} onChange={(e) => setApellidos(e.target.value)} required />
                </label>
              </div>
            )}

            <label className="login__field">
              <span>Correo electrónico</span>
              <input
                type="email"
                autoComplete="email"
                placeholder="nombre@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>

            <label className="login__field">
              <span>Contraseña</span>
              <input
                type="password"
                autoComplete={registro ? "new-password" : "current-password"}
                placeholder={registro ? "Mínimo 8 caracteres" : "Ingresa tu contraseña"}
                maxLength={72}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>

            {registro && (
              <label className="login__field">
                <span>Confirma tu contraseña</span>
                <input type="password" autoComplete="new-password" placeholder="Repite la contraseña" maxLength={72} value={confirmar} onChange={(e) => setConfirmar(e.target.value)} required />
              </label>
            )}

            {error && (
              <div className="login__error" role="alert">
                {error}
              </div>
            )}

            <button type="submit" className="login__submit" disabled={submitting || !email || !password || (registro && (!nombres.trim() || !apellidos.trim() || !confirmar))}>
              {submitting ? (registro ? "Creando cuenta…" : "Ingresando…") : registro ? "Crear cuenta" : "Entrar"}
              {submitting ? <Loader2 size={16} className="login__spin" /> : <ArrowRight size={16} />}
            </button>
          </form>

          <p className="login__switch">
            {registro ? "¿Ya tienes cuenta?" : "¿Eres huésped y aún no tienes cuenta?"}{" "}
            <button type="button" onClick={() => cambiarModo(!registro)}>
              {registro ? "Inicia sesión" : "Crear cuenta"}
            </button>
          </p>

          <p className="login__secure">
            <span className="login__secure-dot" />
            Conexión segura · El personal del hotel entra con el mismo formulario
          </p>
        </div>

        <p className="login__copy">© {CURRENT_YEAR} Hestia Hospitality</p>
      </section>
    </div>
  );
}
