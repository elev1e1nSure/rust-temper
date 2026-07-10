import { useCallback, useEffect, useRef, useState } from "react";
import { Mountain2Line } from "@mingcute/react";
import { invoke } from "@tauri-apps/api/core";
import { clientCfgPathFor } from "../utils/paths";
import { CheckIcon, ChevronIcon, GraphicsIcon, RefreshIcon, SaveIcon } from "../icons";
import "./GraphicsPage.css";

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
    tiers: ["Производительность", "Качество"],
  },
  {
    key: "textures",
    label: "Качество текстур",
    description:
      "Разрешение текстур построек, предметов и ландшафта. Требует больше видеопамяти на высоких значениях.",
    tiers: ["Картошка", "Низкое", "Среднее", "Высокое"],
  },
  {
    key: "lighting",
    label: "Качество освещения",
    description:
      "Количество источников света и качество их обсчёта в кадре. Слабо влияет на FPS.",
    tiers: ["Низкое", "Среднее", "Высокое"],
  },
  {
    key: "water",
    label: "Качество воды",
    description:
      "Качество воды и отражений. Даёт заметный прирост FPS у океана, рек и нефтевышек при снижении.",
    tiers: ["Низкое", "Среднее", "Высокое"],
  },
  {
    key: "grass",
    label: "Качество травы",
    description:
      "Чем выше качество, тем сложнее стрелять. Трава оказывает минимальное влияние на FPS, при выборе руководствуйтесь своим стилем игры.",
    tiers: ["Отключено", "Баланс", "Качество"],
  },
  {
    key: "trees",
    label: "Качество деревьев",
    description:
      "Плотность и детализация деревьев. Сильнее заметно в лесных зонах, где лишняя геометрия может просаживать FPS.",
    tiers: ["Низкое", "Среднее", "Высокое"],
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
      "Сглаживает зубчатые края объектов. Высокие значения дают более мягкую картинку, но стоят больше FPS.",
    tiers: ["Отключено", "Низкое", "Среднее", "Высокое"],
  },
];

const DEFAULT_VALUES: Record<string, number> = {
  shadows: 0,
  textures: 0,
  lighting: 0,
  water: 0,
  grass: 1,
  trees: 1,
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
      textures: 0,
      lighting: 0,
      water: 0,
      grass: 0,
      trees: 1,
      clouds: 0,
      smoothing: 0,
    },
  },
  {
    label: "Комбат",
    values: {
      shadows: 0,
      textures: 1,
      lighting: 0,
      water: 0,
      grass: 0,
      trees: 1,
      clouds: 0,
      smoothing: 0,
    },
  },
  {
    label: "Баланс",
    values: {
      shadows: 1,
      textures: 2,
      lighting: 1,
      water: 1,
      grass: 1,
      trees: 1,
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
      trees: 2,
      clouds: 3,
      smoothing: 3,
    },
  },
];

interface GraphicsPageProps {
  gamePath: string;
}

const PRESET_UNSET = "Пользовательский";

function matchPreset(values: Record<string, number>): string {
  const match = QUICK_PRESETS.find((preset) =>
    QUALITY_ROWS.every((row) => preset.values[row.key] === values[row.key]),
  );
  return match?.label ?? PRESET_UNSET;
}

export function GraphicsPage({ gamePath }: GraphicsPageProps) {
  const [values, setValues] = useState<Record<string, number>>(DEFAULT_VALUES);
  const presetLabel = matchPreset(values);
  const [presetMenuOpen, setPresetMenuOpen] = useState(false);
  const presetMenuRef = useRef<HTMLDivElement>(null);
  const syncRequestRef = useRef(0);
  const [previewKey, setPreviewKey] = useState(QUALITY_ROWS[0]!.key);
  const [applying, setApplying] = useState(false);
  const [syncing, setSyncing] = useState(false);
  // Slider transitions are only ever declared inline, and only once the
  // user has actually touched a control. This keeps the initial load
  // from client.cfg (which lands asynchronously, after the default-value
  // first paint) from ever having a transition to animate through.
  const [interacted, setInteracted] = useState(false);

  const clientCfgPath = gamePath ? clientCfgPathFor(gamePath) : "";

  const syncFromClientCfg = useCallback(async () => {
    if (!clientCfgPath) return;

    const requestId = syncRequestRef.current + 1;
    syncRequestRef.current = requestId;
    setSyncing(true);
    try {
      const results = await Promise.all(
        QUALITY_ROWS.map((row) =>
          invoke<number>("read_graphics_quality", {
            path: clientCfgPath,
            setting: row.key,
          })
            .then((tier) => [row.key, tier] as const)
            .catch((err) => {
              console.error(`Не удалось прочитать «${row.label}»:`, err);
              return null;
            }),
        ),
      );

      if (syncRequestRef.current !== requestId) return;
      setValues((prev) => {
        const next = { ...prev };
        for (const result of results) {
          if (result) next[result[0]] = result[1];
        }
        return next;
      });
    } finally {
      if (syncRequestRef.current === requestId) {
        setSyncing(false);
      }
    }
  }, [clientCfgPath]);

  useEffect(() => {
    if (!clientCfgPath) return;

    syncFromClientCfg();

    return () => {
      syncRequestRef.current += 1;
    };
  }, [clientCfgPath, syncFromClientCfg]);

  useEffect(() => {
    if (!presetMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (!presetMenuRef.current?.contains(e.target as Node)) {
        setPresetMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [presetMenuOpen]);

  const previewRow =
    QUALITY_ROWS.find((r) => r.key === previewKey) ?? QUALITY_ROWS[0]!;

  const setRowValue = useCallback((key: string, value: number) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setInteracted(true);
  }, []);

  const applyQuickPreset = (preset: (typeof QUICK_PRESETS)[number]) => {
    setValues(preset.values);
    setInteracted(true);
    setPresetMenuOpen(false);
  };

  const handleApply = useCallback(async () => {
    if (!clientCfgPath) return;

    setApplying(true);

    try {
      for (const row of QUALITY_ROWS) {
        await invoke("apply_graphics_quality", {
          path: clientCfgPath,
          setting: row.key,
          tier: values[row.key] ?? 0,
        });
      }
    } finally {
      setApplying(false);
    }
  }, [clientCfgPath, values]);

  return (
    <div className="graphics-container page-container">
      <div className="graphics-main">
        <div className="settings-card graphics-preset-card">
          <div className="setting-row graphics-preset-header">
            <span className="setting-name">
              <span className="action-icon setting-name-icon" aria-hidden="true">
                <GraphicsIcon />
              </span>
              Пресет
            </span>
            <div className="graphics-preset-menu" ref={presetMenuRef}>
              <button
                type="button"
                className={`graphics-preset-trigger${presetMenuOpen ? " open" : ""}`}
                onClick={() => setPresetMenuOpen((open) => !open)}
              >
                <span className="graphics-preset-value">{presetLabel}</span>
                <ChevronIcon />
              </button>
              <div
                className={`graphics-preset-dropdown${presetMenuOpen ? " open" : ""}`}
              >
                {QUICK_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    className={`graphics-preset-option${presetLabel === preset.label ? " active" : ""}`}
                    onClick={() => applyQuickPreset(preset)}
                  >
                    <span className="action-icon graphics-preset-option-icon" aria-hidden="true">
                      {presetLabel === preset.label && <CheckIcon />}
                    </span>
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="settings-card settings-card-compact graphics-settings-card">
          {QUALITY_ROWS.map((row) => {
            const value = values[row.key] ?? 0;
            const rawPct =
              row.tiers.length > 1 ? (value / (row.tiers.length - 1)) * 100 : 0;
            const pct = row.tiers.length > 1 ? rawPct * 0.97 + 1.5 : 50;
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
                      style={
                        {
                          "--slider-pct": `${pct}%`,
                          transition: interacted
                            ? "width 0.12s ease-out"
                            : "none",
                        } as React.CSSProperties
                      }
                    />
                    {row.tiers.map((_, i) => (
                      <div
                        key={i}
                        className={`graphics-slider-tick${i <= value ? " active" : ""}`}
                        style={
                          {
                            "--tick-left": `${row.tiers.length > 1 ? (i / (row.tiers.length - 1)) * 97 + 1.5 : 50}%`,
                          } as React.CSSProperties
                        }
                      />
                    ))}
                    <div
                      className="graphics-slider-thumb"
                      style={
                        {
                          "--slider-pct": `${pct}%`,
                          transition: interacted
                            ? "left 0.12s ease-out, background 0.15s ease"
                            : "background 0.15s ease",
                        } as React.CSSProperties
                      }
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
        <div className="graphics-preview-art">
          <div className="graphics-preview-header">
            <div className="graphics-preview-title">{previewRow.label}</div>
            <p className="graphics-preview-desc">{previewRow.description}</p>
          </div>

          <div className="graphics-preview-art-body">
            <div className="graphics-preview-art-icon">
              <Mountain2Line size={40} />
            </div>
            <span className="graphics-preview-art-text">
              Предпросмотр скоро появится
            </span>
          </div>
        </div>

        <div className="graphics-preview-footer">
          <button
            type="button"
            className="graphics-refresh-btn"
            onClick={syncFromClientCfg}
            disabled={syncing || !gamePath}
            aria-label="Синхронизировать с client.cfg"
          >
            <span className="action-icon" aria-hidden="true">
              <RefreshIcon />
            </span>
          </button>
          <button
            type="button"
            className="graphics-apply-btn"
            onClick={handleApply}
            disabled={applying || !gamePath}
          >
            <span className="action-icon" aria-hidden="true">
              <SaveIcon />
            </span>
            {applying ? "Применение..." : "Применить"}
          </button>
        </div>
      </div>
    </div>
  );
}
