import { Bell, ChevronDown, HelpCircle, Menu } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { capitalize, initials } from "../../utils/format";
import "./Header.css";

export default function Header({ title, subtitle, onMenuClick }) {
  const { user } = useAuth();
  const nombre = user?.nombre ?? "";
  const rol = capitalize(user?.rol ?? "");

  return (
    <header className="header">
      <div className="header__left">
        <button type="button" className="header__icon-btn header__menu" onClick={onMenuClick} aria-label="Abrir menú">
          <Menu size={20} strokeWidth={1.75} />
        </button>
        <div className="header__titles">
          <h1 className="header__title">{title}</h1>
          {subtitle && <div className="header__subtitle">{subtitle}</div>}
        </div>
      </div>

      <div className="header__right">
        {/* Notificaciones y ayuda aparecen en el mockup, pero el backend no expone
            datos para ellas todavía; se muestran sin contenido inventado. */}
        <button type="button" className="header__icon-btn" title="Notificaciones" aria-label="Notificaciones">
          <Bell size={18} strokeWidth={1.75} />
        </button>
        <button type="button" className="header__icon-btn header__help" title="Ayuda" aria-label="Ayuda">
          <HelpCircle size={18} strokeWidth={1.75} />
        </button>
        <div className="header__user">
          <div className="header__avatar">{initials(nombre)}</div>
          <div className="header__user-text">
            <div className="header__user-name">{nombre}</div>
            {rol && <div className="header__user-role">{rol}</div>}
          </div>
          <ChevronDown size={14} strokeWidth={1.75} color="var(--gray-400)" className="header__chevron" />
        </div>
      </div>
    </header>
  );
}
