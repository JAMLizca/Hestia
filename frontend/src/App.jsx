import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import { NAV_ITEMS } from "./components/layout/navigation";
import ProtectedRoute from "./components/layout/ProtectedRoute";
import ModulePending from "./components/ui/ModulePending";
import { AuthProvider } from "./context/AuthContext";
import { ConfigProvider } from "./context/ConfigContext";
import { ToastProvider } from "./context/ToastContext";
import ConfiguracionPage from "./pages/ConfiguracionPage";
import DashboardPage from "./pages/DashboardPage";
import HabitacionesPage from "./pages/HabitacionesPage";
import HuespedesPage from "./pages/HuespedesPage";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import PreCheckinPage from "./pages/PreCheckinPage";
import ReservarPage from "./pages/ReservarPage";
import ReservasPage from "./pages/ReservasPage";
import RolesPage from "./pages/RolesPage";
import ServiciosPage from "./pages/ServiciosPage";
import UsuariosPage from "./pages/UsuariosPage";

const PAGES = {
  "/configuracion": ConfiguracionPage,
  "/dashboard": DashboardPage,
  "/reservas": ReservasPage,
  "/habitaciones": HabitacionesPage,
  "/huespedes": HuespedesPage,
  "/roles": RolesPage,
  "/servicios": ServiciosPage,
  "/usuarios": UsuariosPage,
};

const PENDING_REASONS = {};

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <ConfigProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              {/* Público: el huésped abre el enlace que le envía el hotel, sin iniciar sesión. */}
              <Route path="/pre-checkin/:token" element={<PreCheckinPage />} />
              {/* Público: reserva en línea (si el hotel la tiene activada en Configuración). */}
              <Route path="/reservar" element={<ReservarPage />} />

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
        </ConfigProvider>
      </ToastProvider>
    </AuthProvider>
  );
}