import { useState } from "react";
import { Mountain2Line, Refresh1Line } from "@mingcute/react";

interface QualityRow {
  key: string;
  label: string;
  description: string;
  tiers: string[];
}

const QUALITY_ROWS: QualityRow[] = [
  {
    key: "shadows",
    label: "Качество теней",
    description:
      "Влияет на резкость и дальность прорисовки теней. Сильнее всего сказывается на FPS в помещениях и лесах.",
    tiers: ["Отключены", "Производительность", "Баланс", "Качество"],
  },
  {
    key: "textures",
    label: "Качество текстур",
    description:
      "Разрешение текстур построек, предметов и ландшафта. Требует больше видеопамяти на высоких значениях.",
    tiers: ["Картошка", "Низкое", "Среднее", "Высокое", "Ультра"],
  },
  {
    key: "lighting",
    label: "Качество освещения",
    description:
      "Количество источников света и качество их обсчёта в кадре. Слабо влияет на FPS.",
    tiers: ["Низкое", "Среднее", "Высокое"],
  },
  {
    key: "trees",
    label: "Качество деревьев",
    description:
      "Детализация моделей деревьев и дальность их прорисовки. Заметно влияет на FPS в лесистой местности.",
    tiers: ["Низкое", "Среднее", "Высокое"],
  },
  {
    key: "water",
    label: "Отражения на воде",
    description:
      "Отражения на поверхности воды. Дают заметный прирост FPS у океана, рек и нефтевышек при отключении.",
    tiers: ["Отключены", "Низкие", "Высокие"],
  },
  {
    key: "grass",
    label: "Качество травы",
    description:
      "Чем выше качество, тем сложнее стрелять. Трава оказывает минимальное влияние на FPS, при выборе руководствуйтесь своим стилем игры.",
    tiers: ["Отключено", "Производительность", "Комбат", "Баланс", "Качество"],
  },
  {
    key: "clouds",
    label: "Качество облаков",
    description:
      "Детализация и плотность облаков. Минимальное влияние на производительность.",
    tiers: ["Минимальное", "Низкое", "Среднее", "Высокое"],
  },
  {
    key: "smoothing",
    label: "Сглаживание",
    description:
      "Сглаживает зубчатые края объектов. TAA даёт лучшую картинку, но стоит больше FPS, чем FXAA.",
    tiers: ["Отключено", "FXAA", "SMAA", "TAA"],
  },
];

const DEFAULT_VALUES: Record<string, number> = {
  shadows: 1,
  textures: 0,
  lighting: 0,
  trees: 0,
  water: 0,
  grass: 2,
  clouds: 0,
  smoothing: 0,
};

const QUICK_PRESETS: {
  label: string;
  values: Record<string, number>;
  mirrorsOff: boolean;
}[] = [
    {
      label: "Производительность",
      values: {
        shadows: 0,
        textures: 0,
        lighting: 0,
        trees: 0,
        water: 0,
        grass: 0,
        clouds: 0,
        smoothing: 0,
      },
      mirrorsOff: true,
    },
    {
      label: "Комбат",
      values: {
        shadows: 1,
        textures: 0,
        lighting: 0,
        trees: 0,
        water: 0,
        grass: 2,
        clouds: 0,
        smoothing: 0,
      },
      mirrorsOff: true,
    },
    {
      label: "Баланс",
      values: {
        shadows: 2,
        textures: 2,
        lighting: 1,
        trees: 1,
        water: 1,
        grass: 3,
        clouds: 1,
        smoothing: 1,
      },
      mirrorsOff: false,
    },
    {
      label: "Графика",
      values: {
        shadows: 3,
        textures: 4,
        lighting: 2,
        trees: 2,
        water: 2,
        grass: 4,
        clouds: 2,
        smoothing: 2,
      },
      mirrorsOff: false,
    },
  ];

const MIRRORS_DESCRIPTION =
  "Отключает отражения в зеркалах и стёклах. Может заметно повысить FPS в застроенных базах.";

export function GraphicsPage() {
  const [values, setValues] = useState<Record<string, number>>(DEFAULT_VALUES);
  const [mirrorsOff, setMirrorsOff] = useState(false);
  const [presetLabel, setPresetLabel] = useState("Пользовательский");
  const [previewKey, setPreviewKey] = useState(QUALITY_ROWS[0].key);
  const [applied, setApplied] = useState(false);

  const previewRow =
    QUALITY_ROWS.find((r) => r.key === previewKey) ?? QUALITY_ROWS[0];

  const setRowValue = (key: string, value: number) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setPresetLabel("Пользовательский");
  };

  const applyQuickPreset = (preset: (typeof QUICK_PRESETS)[number]) => {
    setValues(preset.values);
    setMirrorsOff(preset.mirrorsOff);
    setPresetLabel(preset.label);
  };

  const resetToDefaults = () => {
    setValues(DEFAULT_VALUES);
    setMirrorsOff(false);
    setPresetLabel("Пользовательский");
  };

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
                  <div className="graphics-slider-track">
                    <div
                      className="graphics-slider-fill"
                      style={{ width: `${pct}%` }}
                    />
                    <div
                      className="graphics-slider-thumb"
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

          <div
            className="setting-row setting-row-clickable tweak-row graphics-toggle-row"
            onClick={() => setMirrorsOff((v) => !v)}
            onMouseEnter={() => setPreviewKey("mirrors")}
          >
            <span className="setting-name tweak-name">
              Отключить отражение зеркал и стёкол
            </span>
            <button
              type="button"
              className={`toggle-switch${mirrorsOff ? " on" : ""}`}
              role="switch"
              aria-checked={mirrorsOff}
              onClick={(e) => {
                e.stopPropagation();
                setMirrorsOff((v) => !v);
              }}
            >
              <span className="toggle-switch-knob" />
            </button>
          </div>
        </div>
      </div>

      <div className="settings-card graphics-preview">
        <div>
          <div className="graphics-preview-title">
            {previewKey === "mirrors"
              ? "Отражения зеркал и стёкол"
              : previewRow.label}
          </div>
          <p className="graphics-preview-desc">
            {previewKey === "mirrors"
              ? MIRRORS_DESCRIPTION
              : previewRow.description}
          </p>
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
            onClick={() => {
              setApplied(true);
              window.setTimeout(() => setApplied(false), 2000);
            }}
          >
            Применить
          </button>
        </div>
        {applied && (
          <p className="status-message graphics-preview-status">
            Пока не подключено к client.cfg — сохранение появится позже
          </p>
        )}
      </div>
    </div>
  );
}
