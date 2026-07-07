import { LoadingLine } from "@mingcute/react";
import "./SettingsPage.css";

interface SettingsPageProps {
  gamePath: string;
  setGamePath: (path: string) => void;
  detecting: boolean;
  handleAutoDetect: () => void;
  handleSelectFile: () => void;
}

export function SettingsPage({
  gamePath,
  setGamePath,
  detecting,
  handleAutoDetect,
  handleSelectFile,
}: SettingsPageProps) {
  return (
    <div className="settings-container page-container">
      <div className="settings-card">
        <div className="setting-group">
          <label className="setting-label">Путь к игре (Rust)</label>
          <input
            type="text"
            className="setting-input"
            value={gamePath}
            onChange={(e) => setGamePath(e.target.value)}
          />
          <div className="path-actions">
            <button
              type="button"
              className={`btn-path${detecting ? " detecting" : ""}`}
              onClick={handleAutoDetect}
              disabled={detecting}
            >
              {detecting && <LoadingLine size={14} />}
              {detecting ? "Поиск..." : "Автоопределение"}
            </button>
            <button
              type="button"
              className="btn-path"
              onClick={handleSelectFile}
            >
              Выбрать папку
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
