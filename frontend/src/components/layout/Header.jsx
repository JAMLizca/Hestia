import { Menu } from "lucide-react";
import { useCallback, useState } from "react";
import ChangePasswordModal from "./ChangePasswordModal";
import { HelpMenu, NotificationsMenu, UserMenu } from "./HeaderMenus";
import "./Header.css";

export default function Header({ title, subtitle, onMenuClick }) {
  // Solo un menú abierto a la vez: "avisos" | "ayuda" | "usuario"
  const [openMenu, setOpenMenu] = useState(null);
  const [changingPassword, setChangingPassword] = useState(false);

  const toggle = (name) => () => setOpenMenu((current) => (current === name ? null : name));
  // Cada menú se cierra solo si es el que está abierto (los callbacks son estables).
  const closeAvisos = useCallback(() => setOpenMenu((c) => (c === "avisos" ? null : c)), []);
  const closeAyuda = useCallback(() => setOpenMenu((c) => (c === "ayuda" ? null : c)), []);
  const closeUsuario = useCallback(() => setOpenMenu((c) => (c === "usuario" ? null : c)), []);

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
        <NotificationsMenu open={openMenu === "avisos"} onToggle={toggle("avisos")} onClose={closeAvisos} />
        <HelpMenu open={openMenu === "ayuda"} onToggle={toggle("ayuda")} onClose={closeAyuda} />
        <UserMenu
          open={openMenu === "usuario"}
          onToggle={toggle("usuario")}
          onClose={closeUsuario}
          onChangePassword={() => setChangingPassword(true)}
        />
      </div>

      {changingPassword && <ChangePasswordModal onClose={() => setChangingPassword(false)} />}
    </header>
  );
}
