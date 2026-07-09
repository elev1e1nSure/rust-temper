import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

const POLL_INTERVAL_MS = 2000;

/**
 * Polls the backend for whether the Rust game client is running. Used to gate
 * all config editing behind a blocking overlay — editing while Rust is open is
 * pointless because the game overwrites its config files from memory on exit.
 */
export function useRustRunning(): boolean {
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const poll = () => {
      invoke<boolean>("is_rust_running")
        .then((value) => {
          if (!cancelled) setRunning(value);
        })
        .catch((err) => {
          // Fail open: never trap the user behind the gate on a probe error.
          console.error("Не удалось проверить, запущен ли Rust:", err);
          if (!cancelled) setRunning(false);
        });
    };

    poll();
    const timer = window.setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return running;
}
