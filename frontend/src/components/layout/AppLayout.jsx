import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useConfig } from "../../context/ConfigContext";
import { formatLongToday, greeting } from "../../utils/format";
import Header from "./Header";
import { NAV_ITEMS } from "./navigation";
import Sidebar from "./Sidebar";
import "./AppLayout.css";

export default function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { config } = useConfig();

  const current = NAV_ITEMS.find((item) => pathname.startsWith(item.to));
  const title = current?.label ?? "Hestia";
  const subtitle =
    current?.to === "/dashboard"
      ? `${greeting()}, ${user?.nombre ?? ""} — ${formatLongToday()}`
      : current?.subtitle;

  return (
    <div className="app-layout">
      <Sidebar open={menuOpen} onNavigate={() => setMenuOpen(false)} />
      {menuOpen && <div className="app-layout__backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" />}
      <div className="app-layout__content">
        <Header title={title} subtitle={subtitle} onMenuClick={() => setMenuOpen(true)} />
        <main className="app-layout__main">
          {/* La moneda cambia cómo se muestran los montos: al cambiarla se vuelve a dibujar la pantalla. */}
          <Outlet key={config.moneda} />
        </main>
      </div>
    </div>
  );
}
