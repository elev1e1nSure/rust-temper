import { Tooltip } from "../Tooltip";
import { ChevronIcon } from "../icons";
import { LoadingLine } from "@mingcute/react";

interface SettingsPageProps {
  configPath: string;
  setConfigPath: (path: string) => void;
  detecting: boolean;
  handleAutoDetect: () => void;
  handleSelectFile: () => void;
  theme: string;
  themeDropdownOpen: boolean;
  themeDropdownDir: "up" | "down";
  setThemeDropdownDir: (v: "up" | "down") => void;
  setThemeDropdownOpen: (v: boolean) => void;
  setTheme: (v: string) => void;
}

export function SettingsPage({
  configPath,
  setConfigPath,
  detecting,
  handleAutoDetect,
  handleSelectFile,
  theme,
  themeDropdownOpen,
  themeDropdownDir,
  setThemeDropdownDir,
  setThemeDropdownOpen,
  setTheme,
}: SettingsPageProps) {
  return (
    <div className="settings-container page-container">
      <div className="settings-card">
        <div className="setting-group">
          <label className="setting-label">
            Путь к файлу конфигурации (keys.cfg)
          </label>
          <input
            type="text"
            className="setting-input"
            value={configPath}
            onChange={(e) => setConfigPath(e.target.value)}
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
              Выбрать файл
            </button>
          </div>
        </div>

        <div className="setting-row">
          <div>
            <div className="setting-name">Цветовая тема</div>
            <div className="setting-desc">
              Выберите тему интерфейса.
            </div>
          </div>
          <div className="theme-select-container">
            <Tooltip content="В разработке">
              <span className="theme-select-wrapper">
                <button
                  className="theme-select-button"
                  type="button"
                  disabled
                  onClick={(e) => {
                    const rect =
                      e.currentTarget.getBoundingClientRect();
                    setThemeDropdownDir(rect.top < 110 ? "down" : "up");
                    setThemeDropdownOpen(!themeDropdownOpen);
                  }}
                >
                  {theme === "dark" ? "Тёмная" : "Светлая"}
                  <ChevronIcon />
                </button>
              </span>
            </Tooltip>
            <div
              className={`dropdown-base theme-dropdown-menu ${themeDropdownOpen ? "open" : ""} ${themeDropdownDir}`}
            >
              <button
                className="theme-dropdown-item"
                type="button"
                onClick={() => {
                  setTheme("dark");
                  setThemeDropdownOpen(false);
                }}
              >
                Тёмная
              </button>
              <button
                className="theme-dropdown-item"
                type="button"
                onClick={() => {
                  setTheme("light");
                  setThemeDropdownOpen(false);
                }}
              >
                Светлая
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
