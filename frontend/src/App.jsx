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
import RolesPage from "./pages/RolesPage";
import ServiciosPage from "./pages/ServiciosPage";
import UsuariosPage from "./pages/UsuariosPage";

const PAGES = {
  "/dashboard": DashboardPage,
  "/reservas": ReservasPage,
  "/habitaciones": HabitacionesPage,
  "/huespedes": HuespedesPage,
  "/roles": RolesPage,
  "/servicios": ServiciosPage,
  "/usuarios": UsuariosPage,
};

const PENDING_REASONS = {
 
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