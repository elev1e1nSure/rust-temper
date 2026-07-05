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
  const [pendingTweaks, setPendingTweaks] = useState<Set<string>>(
    () => new Set(),
  );
  const [error, setError] = useState("");

  useEffect(() => {
    invoke<TweakDef[]>("get_known_tweaks")
      .then(setTweaks)
      .catch((err) =>
        console.error("Не удалось загрузить словарь твиков:", err),
      );
  }, []);

  const clientCfgPath = clientCfgPathFor(configPath);

  const reload = useCallback(async () => {
    if (!clientCfgPath) return;
    const data = await invoke<ClientCfgState>("read_client_cfg", {
      path: clientCfgPath,
    });
    setStates(data.states);
    setRawValues(data.rawValues);
  }, [clientCfgPath]);

  useEffect(() => {
    reload().catch((err) =>
      setError(`Не удалось прочитать client.cfg: ${err}`),
    );
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
    async (tweak: TweakDef) => {
      if (pendingTweaks.has(tweak.key)) return;
      const next = !isOn(tweak);
      setPendingTweaks((prev) => new Set(prev).add(tweak.key));
      setError("");
      try {
        await invoke("toggle_tweak", {
          path: clientCfgPath,
          key: tweak.key,
          enabled: next,
        });
        await reload();
      } catch (err) {
        setError(`Не удалось сохранить твик: ${err}`);
        await reload().catch(() => undefined);
      } finally {
        setPendingTweaks((prev) => {
          const nextPending = new Set(prev);
          nextPending.delete(tweak.key);
          return nextPending;
        });
      }
    },
    [clientCfgPath, isOn, pendingTweaks, reload],
  );

  const setSliderValue = useCallback(
    async (tweak: TweakDef, value: number) => {
      setRawValues((prev) => ({ ...prev, [tweak.key]: String(value) }));
      if (!isOn(tweak)) return;
      try {
        await invoke("set_tweak_slider", {
          path: clientCfgPath,
          key: tweak.key,
          value,
        });
      } catch (err) {
        setError(`Не удалось сохранить значение: ${err}`);
        await reload().catch(() => undefined);
      }
    },
    [clientCfgPath, isOn, reload],
  );

  const isPending = useCallback(
    (tweak: TweakDef) => pendingTweaks.has(tweak.key),
    [pendingTweaks],
  );

  return {
    tweaks,
    isOn,
    isPending,
    sliderValue,
    toggleTweak,
    setSliderValue,
    error,
  };
}
