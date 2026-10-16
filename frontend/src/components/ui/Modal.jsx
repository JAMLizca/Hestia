import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { Button } from "./index";

/** Cierra con Escape y bloquea el scroll del fondo mientras está abierto. */
function useDialogBehavior(onClose) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
}

function DialogShell({ variant, title, subtitle, onClose, footer, width, children, headerExtra }) {
  const titleId = useId();
  const panelRef = useRef(null);
  useDialogBehavior(onClose);
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  return (
    <div
      className={`overlay${variant === "drawer" ? " overlay--drawer" : ""}`}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={variant}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={width ? { "--modal-width": `${width}px` } : undefined}
      >
        <div className="modal__header">
          <div style={{ minWidth: 0 }}>
            <h2 id={titleId} className="modal__title">
              {title}
            </h2>
            {subtitle && <div className="modal__subtitle">{subtitle}</div>}
            {headerExtra}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar" style={{ color: "var(--gray-500)" }}>
            <X size={18} />
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__footer">{footer}</div>}
      </div>
    </div>
  );
}

export function Modal(props) {
  return <DialogShell variant="modal" {...props} />;
}

export function Drawer(props) {
  return <DialogShell variant="drawer" {...props} />;
}

export function ConfirmDialog({ title, message, confirmLabel = "Confirmar", danger, loading, onConfirm, onClose }) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      width={420}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Volver
          </Button>
          <Button variant={danger ? "danger" : "primary"} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p style={{ fontSize: 13, color: "var(--gray-500)", lineHeight: 1.55 }}>{message}</p>
    </Modal>
  );
}
