import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import { NAV_ITEMS } from "./components/layout/navigation";
import ProtectedRoute from "./components/layout/ProtectedRoute";
import RequirePermiso from "./components/layout/RequirePermiso";
import ModulePending from "./components/ui/ModulePending";
import { AuthProvider } from "./context/AuthContext";
import { ConfigProvider } from "./context/ConfigContext";
import { PermisosProvider } from "./context/PermisosContext";
import { ToastProvider } from "./context/ToastContext";
import ConfiguracionPage from "./pages/ConfiguracionPage";
import DashboardPage from "./pages/DashboardPage";
import HabitacionesPage from "./pages/HabitacionesPage";
import HuespedesPage from "./pages/HuespedesPage";
import HotelHomePage from "./pages/HotelHomePage";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import PreCheckinPage from "./pages/PreCheckinPage";
import ReservarPage from "./pages/ReservarPage";
import ReportesPage from "./pages/ReportesPage";
import ReservasPage from "./pages/ReservasPage";
import RolesPage from "./pages/RolesPage";
import ServiciosPage from "./pages/ServiciosPage";
import UsuariosPage from "./pages/UsuariosPage";

const PAGES = {
  "/configuracion": ConfiguracionPage,
  "/dashboard": DashboardPage,
  "/reportes": ReportesPage,
  "/reservas": ReservasPage,
  "/habitaciones": HabitacionesPage,
  "/huespedes": HuespedesPage,
  "/roles": RolesPage,
  "/servicios": ServiciosPage,
  "/usuarios": UsuariosPage,
};

// Pantallas del mockup que aún dependen de endpoints que el backend no tiene (hoy ninguna).
const PENDING_REASONS = {};

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <ConfigProvider>
          <PermisosProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<HotelHomePage />} />
              <Route path="/hestia" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              {/* Público: el huésped abre el enlace que le envía el hotel, sin iniciar sesión. */}
              <Route path="/pre-checkin/:token" element={<PreCheckinPage />} />
              {/* Público: reserva en línea (si el hotel la tiene activada en Configuración). */}
              <Route path="/reservar" element={<ReservarPage />} />

              <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                  {NAV_ITEMS.map(({ to, label, modulo }) => {
                    const Page = PAGES[to];
                    const pantalla = Page ? <Page /> : <ModulePending title={label} text={PENDING_REASONS[to]} />;
                    // Cada pantalla solo se abre si el rol puede "ver" su módulo (RNF-03), aunque escriban la dirección a mano.
                    return <Route key={to} path={to} element={modulo ? <RequirePermiso modulo={modulo}>{pantalla}</RequirePermiso> : pantalla} />;
                  })}
                </Route>
              </Route>

              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </BrowserRouter>
          </PermisosProvider>
        </ConfigProvider>
      </ToastProvider>
    </AuthProvider>
  );
}