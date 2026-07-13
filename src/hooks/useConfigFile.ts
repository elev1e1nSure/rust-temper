import { useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { Bind } from "../types";
import { DEFAULT_GAME_PATH } from "../constants";
import { keysCfgPathFor } from "../utils/paths";

export function useConfigFile() {
  const [gamePath, setGamePath] = useState(DEFAULT_GAME_PATH);
  const [detecting, setDetecting] = useState(false);

  const loadFromPath = useCallback(async (path: string) => {
    return invoke<Bind[]>("read_keys_cfg", {
      path: keysCfgPathFor(path),
    });
  }, []);

  const selectGamePath = async (): Promise<string | null> => {
    const selected = await open({
      directory: true,
      multiple: false,
    });
    return selected;
  };

  const autoDetectConfigPath = async () => {
    setDetecting(true);
    try {
      const found = await invoke<string | null>("find_rust_install");
      return found;
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
    loadFromPath,
    selectGamePath,
    autoDetectConfigPath,
  };
}
