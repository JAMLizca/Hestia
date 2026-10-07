import { LogOut } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Logo from "../ui/Logo";
import { NAV_SECTIONS } from "./navigation";
import "./Sidebar.css";

export default function Sidebar({ open, onNavigate }) {
  const { logout } = useAuth();

  return (
    <aside className={`sidebar${open ? " sidebar--open" : ""}`} aria-label="Menú principal">
      <div className="sidebar__brand">
        <Logo size={36} />
        <div>
          <div className="sidebar__name">HESTIA</div>
          <div className="sidebar__tagline">Gestión Hotelera</div>
        </div>
      </div>

      <nav className="sidebar__nav">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            <div className="sidebar__section">{section.title}</div>
            <div className="sidebar__items">
              {section.items.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={onNavigate}
                  className={({ isActive }) => `sidebar__link${isActive ? " sidebar__link--active" : ""}`}
                >
                  <Icon size={14} strokeWidth={1.75} className="sidebar__icon" />
                  {label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="sidebar__footer">
        <button type="button" className="sidebar__link sidebar__logout" onClick={logout}>
          <LogOut size={14} strokeWidth={1.75} className="sidebar__icon" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
