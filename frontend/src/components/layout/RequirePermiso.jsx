import { Loader2, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { usePermisos } from "../../context/PermisosContext";
import "../ui/ModulePending.css";

/**
 * Protege una pantalla: solo la muestra si el rol del usuario puede `accion` en `modulo`.
 * Si alguien escribe la dirección a mano, ve este aviso en lugar de una pantalla que fallaría con 403.
 */
export default function RequirePermiso({ modulo, accion = "ver", titulo, children }) {
  const { can, ready } = usePermisos();

  if (!ready) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: 160, color: "var(--gold)" }}>
        <Loader2 size={24} style={{ animation: "spin 0.9s linear infinite" }} aria-label="Cargando permisos" />
      </div>
    );
  }
  if (!can(modulo, accion)) {
    return (
      <div className="module-pending" role="alert">
        <div className="module-pending__icon">
          <ShieldAlert size={20} strokeWidth={1.75} />
        </div>
        <h2>{titulo ?? "Acceso restringido"}</h2>
        <p>Tu rol no incluye acceso a esta sección. Si crees que es un error, pídele al administrador que revise tus permisos.</p>
        <p>
          <Link to="/dashboard" style={{ color: "var(--gold)", textDecoration: "underline" }}>
            Volver al inicio
          </Link>
        </p>
      </div>
    );
  }
  return children;
}
