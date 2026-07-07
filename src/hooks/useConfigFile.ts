import { useCallback, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { Bind } from "../types";
import { DEFAULT_CONFIG_PATH } from "../constants";

export function useConfigFile() {
  const [configPath, setConfigPath] = useState(DEFAULT_CONFIG_PATH);
  const [detecting, setDetecting] = useState(false);
  // Флаг реентерабельности: хранится в ref, чтобы не вызывать лишних рендеров,
  // но НЕ экспортируется как ref — потребитель получает только read-only boolean через state.
  const isReloadingRef = useRef(false);
  const [isReloading, setIsReloading] = useState(false);

  const loadFromPath = useCallback(async (path: string) => {
    isReloadingRef.current = true;
    setIsReloading(true);
    try {
      const loaded = await invoke<Bind[]>("read_keys_cfg", { path });
      return loaded;
    } finally {
      isReloadingRef.current = false;
      setIsReloading(false);
    }
  }, []);

  const handleSelectFile = async () => {
    const selected = await open({
      filters: [{ name: "cfg", extensions: ["cfg"] }],
      multiple: false,
    });
    if (selected) {
      setConfigPath(selected);
    }
  };

  const autoDetectConfigPath = async () => {
    const minDelay = new Promise((r) => setTimeout(r, 900));
    setDetecting(true);
    try {
      const found = await invoke<string | null>("find_keys_cfg");
      if (found) {
        setConfigPath(found);
        return found;
      }
      return null;
    } catch (err) {
      console.error("Автопоиск keys.cfg не удался:", err);
      return null;
    } finally {
      await minDelay;
      setDetecting(false);
    }
  };

  return {
    configPath,
    setConfigPath,
    detecting,
    /** true пока идёт чтение файла — безопасно читать в эффектах */
    isReloading,
    /** @internal используется только внутри App для guard в autosave-эффекте */
    _isReloadingRef: isReloadingRef,
    loadFromPath,
    handleSelectFile,
    autoDetectConfigPath,
  };
}
