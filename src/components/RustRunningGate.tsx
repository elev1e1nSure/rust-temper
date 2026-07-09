import { useEffect } from "react";
import { createPortal } from "react-dom";
import "./RustRunningGate.css";

interface RustRunningGateProps {
  running: boolean;
}

/**
 * Full-window blocking overlay shown while the Rust client is running. Blurs the
 * app behind it and refuses all interaction until the game is closed; it has no
 * dismiss control on purpose — it disappears on its own once Rust exits.
 */
export function RustRunningGate({ running }: RustRunningGateProps) {
  // Lock page scroll while the gate is up.
  useEffect(() => {
    if (!running) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [running]);

  if (!running) return null;

  return createPortal(
    <div className="rust-gate" role="alertdialog" aria-modal="true">
      <div className="rust-gate-card">
        <div className="rust-gate-icon" aria-hidden="true">
          <svg
            width="34"
            height="34"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <h2 className="rust-gate-title">Rust запущен</h2>
        <p className="rust-gate-text">
          Закройте игру, чтобы продолжить редактирование конфигов. Пока Rust
          открыт, он перезапишет любые изменения при выходе.
        </p>
      </div>
    </div>,
    document.body,
  );
}
