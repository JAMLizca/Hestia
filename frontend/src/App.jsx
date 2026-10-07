import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import { NAV_ITEMS } from "./components/layout/navigation";
import ProtectedRoute from "./components/layout/ProtectedRoute";
import ModulePending from "./components/ui/ModulePending";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import DashboardPage from "./pages/DashboardPage";
import HabitacionesPage from "./pages/HabitacionesPage";
import HuespedesPage from "./pages/HuespedesPage";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import ReservasPage from "./pages/ReservasPage";
import ServiciosPage from "./pages/ServiciosPage";

const PAGES = {
  "/dashboard": DashboardPage,
  "/reservas": ReservasPage,
  "/habitaciones": HabitacionesPage,
  "/huespedes": HuespedesPage,
  "/servicios": ServiciosPage,
};

// Pantallas del mockup que dependen de endpoints que el backend aún no tiene.
const PENDING_REASONS = {
  "/usuarios": "Requiere endpoints para listar, editar y activar/desactivar usuarios. Hoy el backend solo tiene POST /auth/register y GET /auth/me.",
  "/roles": "El backend solo expone GET y POST /roles, sin permisos por módulo. La matriz de permisos del mockup necesita esa información.",
  "/configuracion": "El backend no tiene endpoints para guardar la información del hotel ni la configuración regional.",
};

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                {NAV_ITEMS.map(({ to, label }) => {
                  const Page = PAGES[to];
                  return (
                    <Route key={to} path={to} element={Page ? <Page /> : <ModulePending title={label} text={PENDING_REASONS[to]} />} />
                  );
                })}
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
