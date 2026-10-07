import { Clock } from "lucide-react";
import "./ModulePending.css";

/** Marcador para pantallas del mockup que aún no se pueden construir con la API actual. */
export default function ModulePending({ title, text = "Esta pantalla se implementa en la siguiente entrega del frontend." }) {
  return (
    <div className="module-pending">
      <div className="module-pending__icon">
        <Clock size={20} strokeWidth={1.75} />
      </div>
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}
