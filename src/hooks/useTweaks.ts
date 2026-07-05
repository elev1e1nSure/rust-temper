import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { TweakDef } from "../types";

function clientCfgPathFor(keysCfgPath: string) {
  return keysCfgPath.replace(/keys\.cfg$/i, "client.cfg");
}

export function useTweaks(configPath: string) {
  const [tweaks, setTweaks] = useState<TweakDef[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    invoke<TweakDef[]>("get_known_tweaks")
      .then(setTweaks)
      .catch((err) =>
        console.error("Не удалось загрузить словарь твиков:", err),
      );
  }, []);

  const clientCfgPath = clientCfgPathFor(configPath);

  useEffect(() => {
    if (!clientCfgPath) return;
    invoke<Record<string, string>>("read_client_cfg", { path: clientCfgPath })
      .then(setValues)
      .catch((err) => setError(`Не удалось прочитать client.cfg: ${err}`));
  }, [clientCfgPath]);

  const valueFor = (tweak: TweakDef) => values[tweak.key] ?? tweak.default;

  const setTweakValue = (tweak: TweakDef, value: string) => {
    setValues((prev) => ({ ...prev, [tweak.key]: value }));
    invoke("write_tweak", { path: clientCfgPath, key: tweak.key, value }).catch(
      (err) => setError(`Не удалось сохранить твик: ${err}`),
    );
  };

  const toggleTweak = (tweak: TweakDef) => {
    if (tweak.valueType.type !== "bool") return;
    const current = valueFor(tweak);
    const next =
      current === tweak.valueType.on ? tweak.valueType.off : tweak.valueType.on;
    setTweakValue(tweak, next);
  };

  return { tweaks, valueFor, toggleTweak, error };
}
