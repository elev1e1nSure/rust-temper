import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  KeyboardLine,
  DocumentLine,
  Settings6Line,
  SearchLine,
  PlusFill,
  Delete2Line,
  DownLine,
} from "@mingcute/react";
import "./App.css";

const DEFAULT_CONFIG_PATH =
  "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Rust\\cfg\\keys.cfg";

type Bind = [key: string, action: string];

const INITIAL_BINDS: Bind[] = [
  ["leftctrl", "Присесть"],
  ["t", "Открыть чат"],
  ["tab", "Инвентарь"],
  ["a", "Вперёд"],
  ["b", "Меню жестов"],
  ["c", "Плавное приближение (FOV 70/90)"],
  ["d", "Вправо"],
  ["f", "Назад"],
  ["g", "Карта (удержание)"],
  ["r", "Перезарядка"],
  ["e", "Взаимодействие"],
  ["q", "Метательное оружие"],
  ["v", "Голосовой чат (удержание)"],
  ["z", "Приседание в полёте"],
  ["x", "Лечь"],
  ["1", "Слот 1"],
  ["2", "Слот 2"],
  ["3", "Слот 3"],
  ["m", "Карта (переключение)"],
  ["l", "Фонарик"],
];

const PRESETS = {
  default: INITIAL_BINDS,
  pvp: [
    ["leftctrl", "Присесть"],
    ["space", "Прыжок + Приседание (Автопрыжок)"],
    ["q", "Быстрый шприц (слот 6)"],
    ["mouse1", "Атака"],
    ["mouse2", "Прицеливание"],
    ["t", "Открыть чат"],
    ["tab", "Инвентарь"],
    ["a", "Вперёд"],
    ["d", "Вправо"],
    ["f", "Назад"],
    ["r", "Перезарядка"],
    ["e", "Взаимодействие"],
    ["v", "Голосовой чат (удержание)"],
    ["x", "Лечь"],
    ["1", "Слот 1"],
    ["2", "Слот 2"],
    ["3", "Слот 3"],
  ],
  building: [
    ["leftctrl", "Присесть"],
    ["r", "Повернуть постройку"],
    ["e", "Взаимодействие (улучшить)"],
    ["mouse1", "Установить постройку"],
    ["tab", "Инвентарь"],
    ["a", "Вперёд"],
    ["d", "Вправо"],
    ["f", "Назад"],
    ["1", "Слот 1 (План постройки)"],
    ["2", "Слот 2 (Киянка)"],
  ],
};

const AVAILABLE_ACTIONS = [
  "Вперёд",
  "Назад",
  "Влево",
  "Вправо",
  "Прыжок",
  "Присесть",
  "Бег",
  "Открыть чат",
  "Инвентарь",
  "Меню жестов",
  "Плавное приближение (FOV 70/90)",
  "Карта (удержание)",
  "Карта (переключение)",
  "Перезарядка",
  "Взаимодействие",
  "Метательное оружие",
  "Голосовой чат (удержание)",
  "Приседание в полёте",
  "Лечь",
  "Слот 1",
  "Слот 2",
  "Слот 3",
  "Фонарик",
  "Атака (левая кнопка мыши)",
  "Прицеливание (правая кнопка мыши)",
  "Прыжок + Приседание (Автопрыжок)",
  "Быстрый шприц (слот 6)",
  "Повернуть постройку",
];

function ChevronIcon() {
  return <DownLine size={15} />;
}

function TrashIcon() {
  return <Delete2Line size={15} />;
}

function SearchIcon() {
  return <SearchLine size={15} />;
}

function PlusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function BindsIcon() {
  return <KeyboardLine size={18} />;
}

function PresetsIcon() {
  return <DocumentLine size={18} />;
}

function SettingsIcon() {
  return <Settings6Line size={18} />;
}

const NAV_ITEMS = [
  { id: "binds", label: "Бинды", icon: BindsIcon },
  { id: "presets", label: "Пресеты", icon: PresetsIcon },
  { id: "settings", label: "Настройки", icon: SettingsIcon },
] as const;

function App() {
  const [activePage, setActivePage] = useState<(typeof NAV_ITEMS)[number]["id"]>("binds");
  const [binds, setBinds] = useState<Bind[]>(INITIAL_BINDS);
  const [search, setSearch] = useState("");
  const [openDropdownIndex, setOpenDropdownIndex] = useState<number | null>(null);
  const [editingKeyIndex, setEditingKeyIndex] = useState<number | null>(null);

  // Settings states
  const [configPath, setConfigPath] = useState(DEFAULT_CONFIG_PATH);
  const [theme, setTheme] = useState("dark");
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);
  const [detecting, setDetecting] = useState(false);

  const autoDetectConfigPath = async () => {
    setDetecting(true);
    try {
      const found = await invoke<string | null>("find_keys_cfg");
      if (found) {
        setConfigPath(found);
      }
      return found;
    } catch (err) {
      console.error("Автопоиск keys.cfg не удался:", err);
      return null;
    } finally {
      setDetecting(false);
    }
  };

  // Run auto-detection once on first launch so the config path is already
  // correct before the user ever opens Settings.
  useEffect(() => {
    autoDetectConfigPath();
  }, []);

  const handleAutoDetect = () => {
    autoDetectConfigPath();
  };

  const handleSelectFile = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".cfg";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const path = (file as any).path || `C:\\Program Files (x86)\\Steam\\steamapps\\common\\Rust\\cfg\\${file.name}`;
        setConfigPath(path);
      }
    };
    input.click();
  };

  const filteredBinds = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return binds;
    return binds.filter(
      ([key, action]) =>
        key.toLowerCase().includes(query) || action.toLowerCase().includes(query),
    );
  }, [binds, search]);

  function addBind() {
    setBinds((prev) => [["новая", "Новое действие"], ...prev]);
  }

  function removeBind(bind: Bind) {
    setBinds((prev) => prev.filter((b) => b !== bind));
  }

  function updateBindAction(index: number, newAction: string) {
    setBinds((prev) => {
      const next = [...prev];
      next[index] = [next[index][0], newAction];
      return next;
    });
    setOpenDropdownIndex(null);
  }

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    e.preventDefault();
    const newKey = e.key.toLowerCase();
    let keyName = newKey;
    if (newKey === " ") keyName = "space";
    if (newKey === "control") keyName = "leftctrl";
    if (newKey === "shift") keyName = "leftshift";
    if (newKey === "alt") keyName = "leftalt";

    setBinds((prev) => {
      const next = [...prev];
      next[index] = [keyName, next[index][1]];
      return next;
    });
    setEditingKeyIndex(null);
  };

  function applyPreset(presetBinds: Bind[]) {
    setBinds(presetBinds);
    setActivePage("binds");
  }

  const activeIndex = NAV_ITEMS.findIndex((item) => item.id === activePage);

  return (
    <div className="app">
      <div className="sidebar">
        <div className="nav">
          <div
            className="nav-indicator"
            style={{
              transform: `translateY(${activeIndex * 42}px)`,
            }}
          />
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`nav-item${activePage === id ? " active" : ""}`}
              onClick={() => setActivePage(id)}
            >
              <Icon />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="main">
        {activePage === "binds" && (
          <div className="page-container">
            <div className="header-row">
              <div className="header-actions">
                <div className="search">
                  <SearchIcon />
                  <input
                    type="text"
                    placeholder="Поиск бинда..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <button className="btn-add" type="button" onClick={addBind}>
                  <PlusIcon />
                  Добавить бинд
                </button>
              </div>
            </div>

            <div className="table-wrap">
              <div className="col-headers">
                <div className="col-key">Клавиша</div>
                <div className="col-action">Действие</div>
              </div>
              <div>
                {filteredBinds.map((bind, index) => {
                  const [key, action] = bind;
                  return (
                    <div className="bind-row" key={`${key}-${action}-${index}`}>
                      <div className="key-cell">
                        <div
                          className={`key-badge ${editingKeyIndex === index ? "editing" : ""}`}
                          onClick={() => setEditingKeyIndex(index)}
                          onKeyDown={(e) => {
                            if (editingKeyIndex === index) {
                              handleKeyDown(e, index);
                            }
                          }}
                          tabIndex={0}
                        >
                          {editingKeyIndex === index ? "Нажмите клавишу..." : key}
                        </div>
                      </div>
                      <div className="action-cell-container">
                        <button
                          className="action-cell"
                          type="button"
                          onClick={() => setOpenDropdownIndex(openDropdownIndex === index ? null : index)}
                        >
                          {action}
                          <ChevronIcon />
                        </button>
                        <div className={`dropdown-menu ${openDropdownIndex === index ? "open" : ""}`}>
                          {AVAILABLE_ACTIONS.map((act) => (
                            <button
                              key={act}
                              className="dropdown-item"
                              type="button"
                              onClick={() => updateBindAction(index, act)}
                            >
                              {act}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="delete-btn" onClick={() => removeBind(bind)}>
                        <TrashIcon />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}

        {activePage === "presets" && (
          <div className="presets-container page-container">
            <div className="presets-list">
              <div className="preset-card">
                <div className="preset-info">
                  <h3>По умолчанию</h3>
                  <p>Стандартная раскладка клавиш Rust.</p>
                </div>
                <button className="btn-preset-apply" onClick={() => applyPreset(PRESETS.default)}>
                  Применить
                </button>
              </div>

              <div className="preset-card">
                <div className="preset-info">
                  <h3>PvP Набор</h3>
                  <p>Оптимизировано для боя: быстрое использование шприцов, автопрыжок.</p>
                </div>
                <button className="btn-preset-apply" onClick={() => applyPreset(PRESETS.pvp)}>
                  Применить
                </button>
              </div>

              <div className="preset-card">
                <div className="preset-info">
                  <h3>Строительство</h3>
                  <p>Удобные клавиши для быстрого вращения и апгрейда конструкций.</p>
                </div>
                <button className="btn-preset-apply" onClick={() => applyPreset(PRESETS.building)}>
                  Применить
                </button>
              </div>
            </div>
          </div>
        )}

        {activePage === "settings" && (
          <div className="settings-container page-container">
            <div className="settings-card">
              <div className="setting-group">
                <label className="setting-label">Путь к файлу конфигурации (keys.cfg)</label>
                <input
                  type="text"
                  className="setting-input"
                  value={configPath}
                  onChange={(e) => setConfigPath(e.target.value)}
                />
                <div className="path-actions">
                  <button type="button" className="btn-path" onClick={handleAutoDetect} disabled={detecting}>
                    {detecting ? "Поиск..." : "Автоопределение"}
                  </button>
                  <button type="button" className="btn-path" onClick={handleSelectFile}>
                    Выбрать файл
                  </button>
                </div>
              </div>

              <div className="setting-row">
                <div>
                  <div className="setting-name">Цветовая тема</div>
                  <div className="setting-desc">Выберите тему интерфейса.</div>
                </div>
                <div className="theme-select-container">
                  <button
                    className="theme-select-button"
                    type="button"
                    onClick={() => setThemeDropdownOpen(!themeDropdownOpen)}
                  >
                    {theme === "dark" ? "Тёмная" : "Светлая"}
                    <ChevronIcon />
                  </button>
                  <div className={`theme-dropdown-menu ${themeDropdownOpen ? "open" : ""}`}>
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
        )}
      </div>
    </div>
  );
}

export default App;
