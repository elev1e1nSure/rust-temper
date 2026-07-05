import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { TweakDef } from "../types";

function clientCfgPathFor(keysCfgPath: string) {
  return keysCfgPath.replace(/keys\.cfg$/i, "client.cfg");
}

interface ClientCfgState {
  states: Record<string, boolean>;
  rawValues: Record<string, string>;
}

export function useTweaks(configPath: string) {
  const [tweaks, setTweaks] = useState<TweakDef[]>([]);
  const [states, setStates] = useState<Record<string, boolean>>({});
  const [rawValues, setRawValues] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    invoke<TweakDef[]>("get_known_tweaks")
      .then(setTweaks)
      .catch((err) =>
        console.error("Не удалось загрузить словарь твиков:", err),
      );
  }, []);

  const clientCfgPath = clientCfgPathFor(configPath);

  const reload = useCallback(() => {
    if (!clientCfgPath) return;
    invoke<ClientCfgState>("read_client_cfg", { path: clientCfgPath })
      .then((data) => {
        setStates(data.states);
        setRawValues(data.rawValues);
      })
      .catch((err) => setError(`Не удалось прочитать client.cfg: ${err}`));
  }, [clientCfgPath]);

  useEffect(() => {
    reload();
  }, [reload]);

  const isOn = useCallback(
    (tweak: TweakDef) => states[tweak.key] ?? false,
    [states],
  );

  const sliderValue = useCallback(
    (tweak: TweakDef) => {
      if (!tweak.advancedSlider) return 0;
      const raw = rawValues[tweak.key];
      return raw !== undefined
        ? Number(raw)
        : tweak.advancedSlider.defaultValue;
    },
    [rawValues],
  );

  const toggleTweak = useCallback(
    (tweak: TweakDef) => {
      const next = !isOn(tweak);
      setStates((prev) => ({ ...prev, [tweak.key]: next }));
      invoke("toggle_tweak", {
        path: clientCfgPath,
        key: tweak.key,
        enabled: next,
      }).catch((err) => setError(`Не удалось сохранить твик: ${err}`));
    },
    [clientCfgPath, isOn],
  );

  const setSliderValue = useCallback(
    (tweak: TweakDef, value: number) => {
      setRawValues((prev) => ({ ...prev, [tweak.key]: String(value) }));
      if (!isOn(tweak)) return;
      invoke("set_tweak_slider", {
        path: clientCfgPath,
        key: tweak.key,
        value,
      }).catch((err) => setError(`Не удалось сохранить значение: ${err}`));
    },
    [clientCfgPath, isOn],
  );

  return { tweaks, isOn, sliderValue, toggleTweak, setSliderValue, error };
}
