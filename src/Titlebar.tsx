import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./Titlebar.css";

function MinimizeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <rect x="4" y="12.5" width="16" height="2.5" rx="1.25" />
    </svg>
  );
}

function MaximizeIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <rect x="4" y="4" width="16" height="16" rx="2.5" />
    </svg>
  );
}

function RestoreIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <rect x="7" y="2" width="13" height="13" rx="2.5" />
      <rect x="4" y="9" width="13" height="13" rx="2.5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <line x1="5" y1="5" x2="19" y2="19" />
      <line x1="19" y1="5" x2="5" y2="19" />
    </svg>
  );
}

export function Titlebar() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const win = getCurrentWindow();

    win.isMaximized().then(setMaximized);

    const unlisten = win.onResized(async () => {
      setMaximized(await win.isMaximized());
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  return (
    <div className="titlebar">
      <div data-tauri-drag-region className="titlebar-drag" />
      <div className="titlebar-controls">
        <button
          className="titlebar-btn"
          type="button"
          onClick={() => getCurrentWindow().minimize()}
        >
          <MinimizeIcon />
        </button>
        <button
          className="titlebar-btn"
          type="button"
          onClick={() => getCurrentWindow().toggleMaximize()}
        >
          {maximized ? <RestoreIcon /> : <MaximizeIcon />}
        </button>
        <button
          className="titlebar-btn close"
          type="button"
          onClick={() => getCurrentWindow().close()}
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
}
