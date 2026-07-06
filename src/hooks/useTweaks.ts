import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { TweakDef } from "../types";

function clientCfgPathFor(keysCfgPath: string) {
  return keysCfgPath.replace(/keys\.cfg$/i, "client.cfg");
}

interface ClientCfgState {
  states: Record<string, boolean>;
  managedStates: Record<string, boolean>;
  rawValues: Record<string, string>;
}

export function useTweaks(configPath: string) {
  const [tweaks, setTweaks] = useState<TweakDef[]>([]);
  const [states, setStates] = useState<Record<string, boolean>>({});
  const [managedStates, setManagedStates] = useState<Record<string, boolean>>(
    {},
  );
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
      keysCfgPath: configPath,
    });
    setStates(data.states);
    setManagedStates(data.managedStates);
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

  const isManaged = useCallback(
    (tweak: TweakDef) => managedStates[tweak.key] ?? false,
    [managedStates],
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
    async (tweak: TweakDef, forceUnmanaged = false) => {
      if (pendingTweaks.has(tweak.key)) return false;
      const next = !isOn(tweak);
      setPendingTweaks((prev) => new Set(prev).add(tweak.key));
      setError("");
      try {
        await invoke("toggle_tweak", {
          path: clientCfgPath,
          key: tweak.key,
          enabled: next,
          forceUnmanaged,
          keysCfgPath: configPath,
        });
        await reload();
        return true;
      } catch (err) {
        setError(`Не удалось сохранить твик: ${err}`);
        await reload().catch(() => undefined);
        return false;
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
    isManaged,
    isPending,
    sliderValue,
    toggleTweak,
    setSliderValue,
    error,
  };
}
