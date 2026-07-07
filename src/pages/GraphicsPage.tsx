import { useCallback, useEffect, useState } from "react";
import { Mountain2Line, Refresh1Line } from "@mingcute/react";
import { invoke } from "@tauri-apps/api/core";
import { clientCfgPathFor } from "../utils/paths";
import "./GraphicsPage.css";

interface QualityRow {
  key: string;
  label: string;
  description: string;
  tiers: string[];
  /** Tauri command that reads the current tier from client.cfg on mount. */
  readCmd: string;
  /** Tauri command that writes the selected tier back to client.cfg. */
  applyCmd: string;
}

const QUALITY_ROWS: QualityRow[] = [
  {
    key: "shadows",
    label: "Качество теней",
    description:
      "Влияет на резкость и дальность прорисовки теней. Сильнее всего сказывается на FPS в помещениях и лесах.",
    tiers: ["Производительность", "Качество"],
    readCmd: "read_shadow_quality",
    applyCmd: "apply_shadow_quality",
  },
  {
    key: "textures",
    label: "Качество текстур",
    description:
      "Разрешение текстур построек, предметов и ландшафта. Требует больше видеопамяти на высоких значениях.",
    tiers: ["Картошка", "Низкое", "Среднее", "Высокое"],
    readCmd: "read_texture_quality",
    applyCmd: "apply_texture_quality",
  },
  {
    key: "lighting",
    label: "Качество освещения",
    description:
      "Количество источников света и качество их обсчёта в кадре. Слабо влияет на FPS.",
    tiers: ["Низкое", "Среднее", "Высокое"],
    readCmd: "read_lighting_quality",
    applyCmd: "apply_lighting_quality",
  },
  {
    key: "water",
    label: "Отражения на воде",
    description:
      "Отражения на поверхности воды. Дают заметный прирост FPS у океана, рек и нефтевышек при отключении.",
    tiers: ["Отключены", "Низкие", "Высокие"],
    readCmd: "read_water_quality",
    applyCmd: "apply_water_quality",
  },
  {
    key: "grass",
    label: "Качество травы",
    description:
      "Чем выше качество, тем сложнее стрелять. Трава оказывает минимальное влияние на FPS, при выборе руководствуйтесь своим стилем игры.",
    tiers: ["Отключено", "Баланс", "Качество"],
    readCmd: "read_grass_quality",
    applyCmd: "apply_grass_quality",
  },
  {
    key: "clouds",
    label: "Качество облаков",
    description:
      "Детализация и плотность облаков. Минимальное влияние на производительность.",
    tiers: ["Минимальное", "Низкое", "Среднее", "Высокое"],
    readCmd: "read_clouds_quality",
    applyCmd: "apply_clouds_quality",
  },
  {
    key: "smoothing",
    label: "Сглаживание",
    description:
      "Сглаживает зубчатые края объектов. TAA даёт лучшую картинку, но стоит больше FPS, чем FXAA.",
    tiers: ["Отключено", "FXAA", "SMAA", "TAA"],
    readCmd: "read_smoothing_quality",
    applyCmd: "apply_smoothing_quality",
  },
];

const DEFAULT_VALUES: Record<string, number> = {
  shadows: 0,
  textures: 0,
  lighting: 0,
  water: 0,
  grass: 1,
  clouds: 0,
  smoothing: 0,
};

const QUICK_PRESETS: {
  label: string;
  values: Record<string, number>;
}[] = [
  {
    label: "Производительность",
    values: {
      shadows: 0,
      textures: 3,
      lighting: 0,
      water: 0,
      grass: 0,
      clouds: 0,
      smoothing: 0,
    },
  },
  {
    label: "Комбат",
    values: {
      shadows: 0,
      textures: 2,
      lighting: 0,
      water: 0,
      grass: 0,
      clouds: 0,
      smoothing: 0,
    },
  },
  {
    label: "Баланс",
    values: {
      shadows: 1,
      textures: 1,
      lighting: 1,
      water: 2,
      grass: 2,
      clouds: 1,
      smoothing: 1,
    },
  },
  {
    label: "Графика",
    values: {
      shadows: 1,
      textures: 3,
      lighting: 2,
      water: 2,
      grass: 2,
      clouds: 3,
      smoothing: 3,
    },
  },
];

interface GraphicsPageProps {
  configPath: string;
}

export function GraphicsPage({ configPath }: GraphicsPageProps) {
  const [values, setValues] = useState<Record<string, number>>(DEFAULT_VALUES);
  const [presetLabel, setPresetLabel] = useState("Пользовательский");
  const [previewKey, setPreviewKey] = useState(QUALITY_ROWS[0]!.key);
  const [applyStatus, setApplyStatus] = useState<
    { type: "success" | "error"; message: string } | undefined
  >();
  const [applying, setApplying] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const clientCfgPath = configPath ? clientCfgPathFor(configPath) : "";

  useEffect(() => {
    setLoaded(false);
    if (!clientCfgPath) return;
    let cancelled = false;

    Promise.all(
      QUALITY_ROWS.map((row) =>
        invoke<number>(row.readCmd, { path: clientCfgPath })
          .then((tier) => [row.key, tier] as const)
          .catch((err) => {
            console.error(`Не удалось прочитать «${row.label}»:`, err);
            return null;
          }),
      ),
    ).then((results) => {
      if (cancelled) return;
      setValues((prev) => {
        const next = { ...prev };
        for (const result of results) {
          if (result) next[result[0]] = result[1];
        }
        return next;
      });
      setLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, [clientCfgPath]);

  const previewRow =
    QUALITY_ROWS.find((r) => r.key === previewKey) ?? QUALITY_ROWS[0]!;

  const setRowValue = useCallback((key: string, value: number) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setPresetLabel("Пользовательский");
  }, []);

  const applyQuickPreset = (preset: (typeof QUICK_PRESETS)[number]) => {
    setValues(preset.values);
    setPresetLabel(preset.label);
  };

  const resetToDefaults = () => {
    setValues(DEFAULT_VALUES);
    setPresetLabel("Пользовательский");
  };

  const handleApply = useCallback(async () => {
    if (!clientCfgPath) {
      setApplyStatus({
        type: "error",
        message: "Не указан путь к файлам конфигурации",
      });
      return;
    }

    setApplying(true);
    setApplyStatus(undefined);

    try {
      for (const row of QUALITY_ROWS) {
        await invoke(row.applyCmd, {
          path: clientCfgPath,
          tier: values[row.key] ?? 0,
        });
      }
      setApplyStatus({
        type: "success",
        message: "Настройки графики применены",
      });
    } catch (err) {
      setApplyStatus({
        type: "error",
        message: `Не удалось применить настройки: ${err}`,
      });
    } finally {
      setApplying(false);
    }
  }, [clientCfgPath, values]);

  return (
    <div className="graphics-container page-container">
      <div className="graphics-main">
        <div className="settings-card graphics-preset-card">
          <div className="setting-row graphics-preset-header">
            <span className="setting-name">Пресет</span>
            <span className="graphics-preset-value">{presetLabel}</span>
          </div>
          <div className="graphics-preset-tabs">
            {QUICK_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className={`graphics-preset-tab${presetLabel === preset.label ? " active" : ""}`}
                onClick={() => applyQuickPreset(preset)}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-card settings-card-compact graphics-settings-card">
          {QUALITY_ROWS.map((row) => {
            const value = values[row.key] ?? 0;
            const pct =
              row.tiers.length > 1 ? (value / (row.tiers.length - 1)) * 100 : 0;
            return (
              <div
                key={row.key}
                className="graphics-row"
                onMouseEnter={() => setPreviewKey(row.key)}
                onFocus={() => setPreviewKey(row.key)}
              >
                <div className="graphics-row-header">
                  <span className="setting-name">{row.label}</span>
                  <span className="graphics-row-value">{row.tiers[value]}</span>
                </div>
                <div className="graphics-slider-wrap">
                  <div
                    className={`graphics-slider-track${loaded ? "" : " no-transition"}`}
                  >
                    <div
                      className={`graphics-slider-fill${loaded ? "" : " no-transition"}`}
                      style={{ width: `${pct}%` }}
                    />
                    {row.tiers.map((_, i) => (
                      <div
                        key={i}
                        className="graphics-slider-tick"
                        style={{
                          left: `${(i / (row.tiers.length - 1)) * 100}%`,
                        }}
                      />
                    ))}
                    <div
                      className={`graphics-slider-thumb${loaded ? "" : " no-transition"}`}
                      style={{ left: `${pct}%` }}
                    />
                  </div>
                  <input
                    type="range"
                    className="graphics-slider-input"
                    min={0}
                    max={row.tiers.length - 1}
                    step={1}
                    value={value}
                    onChange={(e) =>
                      setRowValue(row.key, Number(e.target.value))
                    }
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="settings-card graphics-preview">
        <div>
          <div className="graphics-preview-title">{previewRow.label}</div>
          <p className="graphics-preview-desc">{previewRow.description}</p>
        </div>

        <div className="graphics-preview-art">
          <div className="graphics-preview-art-icon">
            <Mountain2Line size={40} />
          </div>
          <span className="graphics-preview-art-text">
            Предпросмотр скоро появится
          </span>
        </div>

        <div className="graphics-preview-footer">
          <button
            type="button"
            className="graphics-refresh-btn"
            onClick={resetToDefaults}
            aria-label="Сбросить настройки"
          >
            <Refresh1Line size={16} />
          </button>
          <button
            type="button"
            className="graphics-apply-btn"
            onClick={handleApply}
            disabled={applying || !configPath}
          >
            {applying ? "Применение..." : "Применить"}
          </button>
        </div>
        {applyStatus && (
          <p
            className={`status-message graphics-preview-status${applyStatus.type === "error" ? " status-error" : ""}`}
          >
            {applyStatus.message}
          </p>
        )}
      </div>
    </div>
  );
}
