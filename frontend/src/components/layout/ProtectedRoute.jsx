import { Loader2 } from "lucide-react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function ProtectedRoute() {
  const { status, manualLogout } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <div style={{ display: "grid", placeItems: "center", height: "100%", color: "var(--gold)" }}>
        <Loader2 size={28} style={{ animation: "spin 0.9s linear infinite" }} aria-label="Cargando sesión" />
      </div>
    );
  }
  // Si la sesión expiró se recuerda la pantalla para volver a ella tras el login;
  // si el usuario cerró sesión a propósito, no.
  if (status !== "authenticated") return <Navigate to="/login" replace state={manualLogout ? undefined : { from: location }} />;
  return <Outlet />;
}
