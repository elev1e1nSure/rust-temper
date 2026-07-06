import { useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Bind } from "../types";
import { DEFAULT_CONFIG_PATH } from "../constants";

export function useConfigFile() {
  const [configPath, setConfigPath] = useState(DEFAULT_CONFIG_PATH);
  const [detecting, setDetecting] = useState(false);
  const isReloadingRef = useRef(false);

  const loadFromPath = async (path: string) => {
    isReloadingRef.current = true;
    try {
      const loaded = await invoke<Bind[]>("read_keys_cfg", { path });
      return loaded;
    } finally {
      isReloadingRef.current = false;
    }
  };

  const handleSelectFile = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".cfg";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const path =
        (file as any).path ||
        `C:\\Program Files (x86)\\Steam\\steamapps\\common\\Rust\\cfg\\${file.name}`;
      setConfigPath(path);
    };
    input.click();
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
    isReloadingRef,
    loadFromPath,
    handleSelectFile,
    autoDetectConfigPath,
  };
}
