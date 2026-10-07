import { ArrowRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import logoCompleto from "../assets/logo-hestia-completo.webp";
import Logo from "../components/ui/Logo";
import { useAuth } from "../context/AuthContext";
import "./LoginPage.css";

const CURRENT_YEAR = new Date().getFullYear();

export default function LoginPage() {
  const { login, status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const destino = location.state?.from?.pathname || "/dashboard";
  if (status === "authenticated") return <Navigate to={destino} replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate(destino, { replace: true });
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
        <div className="login__form-wrap">
          <div className="login__logo-card">
            <img src={logoCompleto} alt="Hestia — Gestión hotelera" />
          </div>

          <p className="login__eyebrow">Bienvenido de nuevo</p>
          <h1 className="login__title">Inicia sesión</h1>
          <p className="login__subtitle">Ingresa tus datos para acceder al panel de gestión.</p>

          <form className="login__form" onSubmit={handleSubmit} noValidate>
            <label className="login__field">
              <span>Correo electrónico</span>
              <input
                type="email"
                autoComplete="email"
                placeholder="nombre@hotel.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>

            <label className="login__field">
              <span>Contraseña</span>
              <input
                type="password"
                autoComplete="current-password"
                placeholder="Ingresa tu contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>

            {error && (
              <div className="login__error" role="alert">
                {error}
              </div>
            )}

            <button type="submit" className="login__submit" disabled={submitting || !email || !password}>
              {submitting ? "Ingresando…" : "Entrar al panel"}
              {submitting ? <Loader2 size={16} className="login__spin" /> : <ArrowRight size={16} />}
            </button>
          </form>

          <p className="login__secure">
            <span className="login__secure-dot" />
            Conexión segura · Acceso exclusivo para el equipo
          </p>
        </div>

        <p className="login__copy">© {CURRENT_YEAR} Hestia Hospitality</p>
      </section>
    </div>
  );
}
