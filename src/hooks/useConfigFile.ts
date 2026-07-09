import { useCallback, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { Bind } from "../types";
import { DEFAULT_GAME_PATH } from "../constants";
import { keysCfgPathFor } from "../utils/paths";

export function useConfigFile() {
  const [gamePath, setGamePath] = useState(DEFAULT_GAME_PATH);
  const [detecting, setDetecting] = useState(false);
  // Флаг реентерабельности: хранится в ref, чтобы не вызывать лишних рендеров,
  // но НЕ экспортируется как ref — потребитель получает только read-only boolean через state.
  const isReloadingRef = useRef(false);
  const [isReloading, setIsReloading] = useState(false);

  const loadFromPath = useCallback(async (path: string) => {
    isReloadingRef.current = true;
    setIsReloading(true);
    try {
      const loaded = await invoke<Bind[]>("read_keys_cfg", {
        path: keysCfgPathFor(path),
      });
      return loaded;
    } finally {
      isReloadingRef.current = false;
      setIsReloading(false);
    }
  }, []);

  const handleSelectFile = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
    });
    if (selected) {
      setGamePath(selected);
    }
  };

  const autoDetectConfigPath = async () => {
    setDetecting(true);
    try {
      const found = await invoke<string | null>("find_rust_install");
      if (found) {
        setGamePath(found);
        return found;
      }
      return null;
    } catch (err) {
      console.error("Автопоиск установки Rust не удался:", err);
      return null;
    } finally {
      window.setTimeout(() => {
        setDetecting(false);
      }, 250);
    }
  };

  return {
    gamePath,
    setGamePath,
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
