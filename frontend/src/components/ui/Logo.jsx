import logoCirculo from "../../assets/logo-hestia-circulo.webp";
import "./Logo.css";

/** Logo circular de Hestia (menú lateral, login y landing). */
export default function Logo({ size = 36, bordered = true }) {
  return (
    <img
      className={`logo${bordered ? "" : " logo--plain"}`}
      src={logoCirculo}
      alt="Hestia"
      width={size}
      height={size}
      style={{ width: size, height: size }}
    />
  );
}
