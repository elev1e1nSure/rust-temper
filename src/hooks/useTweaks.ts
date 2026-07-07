import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { TweakDef } from "../types";
import { clientCfgPathFor, keysCfgPathFor } from "../utils/paths";

// ---------------------------------------------------------------------------
// Runtime-валидация ответа бэкенда
// Вместо слепого приведения типа проверяем форму объекта:
// если бэкенд вернёт иную структуру — получим явную ошибку, а не молчаливый баг.
// ---------------------------------------------------------------------------

interface ClientCfgState {
  states: Record<string, boolean>;
  managedStates: Record<string, boolean>;
  rawValues: Record<string, string>;
}

function isRecordOf<V>(
  obj: unknown,
  checkValue: (v: unknown) => v is V,
): obj is Record<string, V> {
  return (
    typeof obj === "object" &&
    obj !== null &&
    !Array.isArray(obj) &&
    Object.values(obj).every(checkValue)
  );
}

function parseClientCfgState(raw: unknown): ClientCfgState {
  if (typeof raw !== "object" || raw === null) {
    throw new Error(`read_client_cfg вернул неожиданный тип: ${typeof raw}`);
  }
  const r = raw as Record<string, unknown>;

  if (!isRecordOf(r.states, (v): v is boolean => typeof v === "boolean")) {
    throw new Error(
      "read_client_cfg: поле 'states' отсутствует или имеет неверный тип",
    );
  }
  if (
    !isRecordOf(r.managedStates, (v): v is boolean => typeof v === "boolean")
  ) {
    throw new Error(
      "read_client_cfg: поле 'managedStates' отсутствует или имеет неверный тип",
    );
  }
  if (!isRecordOf(r.rawValues, (v): v is string => typeof v === "string")) {
    throw new Error(
      "read_client_cfg: поле 'rawValues' отсутствует или имеет неверный тип",
    );
  }

  return {
    states: r.states,
    managedStates: r.managedStates,
    rawValues: r.rawValues,
  };
}

export function useTweaks(gamePath: string) {
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

  const clientCfgPath = clientCfgPathFor(gamePath);
  const keysCfgPath = keysCfgPathFor(gamePath);

  const reload = useCallback(async () => {
    if (!clientCfgPath) return;
    const raw = await invoke<unknown>("read_client_cfg", {
      path: clientCfgPath,
      keysCfgPath,
    });
    const data = parseClientCfgState(raw);
    setStates(data.states);
    setManagedStates(data.managedStates);
    setRawValues(data.rawValues);
  }, [clientCfgPath, keysCfgPath]);

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
          keysCfgPath,
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
    [clientCfgPath, keysCfgPath, isOn, pendingTweaks, reload],
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
