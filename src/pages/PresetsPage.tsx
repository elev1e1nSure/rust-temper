import type { Bind } from "../types";
import { PVP_PRESET, BUILDING_PRESET } from "../presets";
import { ToolLine } from "@mingcute/react";

interface PresetsPageProps {
  configPath: string;
  loadFromPath: (path: string) => Promise<Bind[] | undefined>;
  applyPreset: (presetBinds: Bind[]) => void;
}

export function PresetsPage({
  configPath,
  loadFromPath,
  applyPreset,
}: PresetsPageProps) {
  return (
    <div className="presets-container page-container">
      <div className="presets-blur-wrapper">
        <div className="presets-list">
          <div className="preset-card">
            <div className="preset-info">
              <h3>По умолчанию</h3>
              <p>
                Перечитать текущий keys.cfg с диска, отменив
                несохранённые правки.
              </p>
            </div>
            <button
              className="btn-preset-apply"
              type="button"
              onClick={() => loadFromPath(configPath)}
            >
              Применить
            </button>
          </div>

          <div className="preset-card">
            <div className="preset-info">
              <h3>PvP Набор</h3>
              <p>
                Оптимизировано для боя: быстрое переключение на шприц,
                зажатое прицеливание.
              </p>
            </div>
            <button
              className="btn-preset-apply"
              type="button"
              onClick={() => applyPreset(PVP_PRESET)}
            >
              Применить
            </button>
          </div>

          <div className="preset-card">
            <div className="preset-info">
              <h3>Строительство</h3>
              <p>
                Удобные клавиши для быстрого взаимодействия и апгрейда
                конструкций.
              </p>
            </div>
            <button
              className="btn-preset-apply"
              type="button"
              onClick={() => applyPreset(BUILDING_PRESET)}
            >
              Применить
            </button>
          </div>
        </div>
      </div>

      <div className="presets-overlay">
        <div className="presets-overlay-icon">
          <ToolLine size={44} />
        </div>
        <p className="presets-overlay-text">Пресеты в разработке</p>
        <p className="presets-overlay-sub">
          Скоро здесь появятся пресеты...
        </p>
      </div>
    </div>
  );
}
