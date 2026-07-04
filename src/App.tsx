import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  KeyboardLine,
  DocumentLine,
  Settings6Line,
  SearchLine,
  Delete2Line,
  DownLine,
} from "@mingcute/react";
import "./App.css";

const DEFAULT_CONFIG_PATH =
  "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Rust\\cfg\\keys.cfg";

interface Bind {
  key: string;
  command: string;
}

interface CommandPreset {
  name: string;
  command: string;
  description: string;
}

const FALLBACK_DESCRIPTION =
  "Команда не описана в словаре — задайте бинд через список, чтобы увидеть подсказку.";

// Bind-focused subsets of the full command dictionary — real console commands,
// not the free-text labels the old mock UI used.
const PVP_PRESET: Bind[] = [
  { key: "leftctrl", command: "+duck" },
  { key: "space", command: "+jump" },
  { key: "q", command: "+slot6" },
  { key: "mouse0", command: "+attack" },
  { key: "mouse1", command: "+attack2" },
  { key: "t", command: "chat.open" },
  { key: "tab", command: "inventory.toggle" },
  { key: "a", command: "+forward" },
  { key: "d", command: "+right" },
  { key: "f", command: "+backward" },
  { key: "r", command: "+reload" },
  { key: "e", command: "+use" },
  { key: "x", command: "+sprint" },
  { key: "1", command: "+slot1" },
  { key: "2", command: "+slot2" },
  { key: "3", command: "+slot3" },
];

const BUILDING_PRESET: Bind[] = [
  { key: "leftctrl", command: "+duck" },
  { key: "e", command: "+use" },
  { key: "mouse0", command: "+attack" },
  { key: "tab", command: "inventory.toggle" },
  { key: "a", command: "+forward" },
  { key: "d", command: "+right" },
  { key: "f", command: "+backward" },
  { key: "1", command: "+slot1" },
  { key: "2", command: "+slot2" },
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

// Maps browser KeyboardEvent.key values to the key names Rust's keys.cfg
// expects. Covers the keys a player would realistically bind; anything
// unmapped falls back to the lowercased event key.
const KEY_NAME_MAP: Record<string, string> = {
  " ": "space",
  control: "leftctrl",
  shift: "leftshift",
  alt: "leftalt",
  capslock: "capslock",
  escape: "escape",
  enter: "enter",
  backspace: "backspace",
  tab: "tab",
  arrowup: "uparrow",
  arrowdown: "downarrow",
  arrowleft: "leftarrow",
  arrowright: "rightarrow",
  insert: "insert",
  delete: "delete",
  home: "home",
  end: "end",
  pageup: "pageup",
  pagedown: "pagedown",
  f1: "f1",
  f2: "f2",
  f3: "f3",
  f4: "f4",
  f5: "f5",
  f6: "f6",
  f7: "f7",
  f8: "f8",
  f9: "f9",
  f10: "f10",
  f11: "f11",
  f12: "f12",
};

function keyNameFromEvent(e: KeyboardEvent): string {
  const raw = e.key.toLowerCase();
  return KEY_NAME_MAP[raw] ?? raw;
}

const NAV_ITEMS = [
  { id: "binds", label: "Бинды", icon: BindsIcon },
  { id: "presets", label: "Пресеты", icon: PresetsIcon },
  { id: "settings", label: "Настройки", icon: SettingsIcon },
] as const;

function App() {
  const [activePage, setActivePage] = useState<(typeof NAV_ITEMS)[number]["id"]>("binds");
  const [binds, setBinds] = useState<Bind[]>([]);
  const [search, setSearch] = useState("");
  const [openDropdownIndex, setOpenDropdownIndex] = useState<number | null>(null);
  const [closingDropdownIndex, setClosingDropdownIndex] = useState<number | null>(null);
  const closingDropdownTimeoutRef = useRef<number | null>(null);
  const [editingKeyIndex, setEditingKeyIndex] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [commandPresets, setCommandPresets] = useState<CommandPreset[]>([]);

  // Sidebar resizable width
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem("sidebar-width");
    return saved ? parseInt(saved, 10) : 236;
  });

  const startResizing = (mouseDownEvent: React.MouseEvent) => {
    mouseDownEvent.preventDefault();
    const startWidth = sidebarWidth;
    const startX = mouseDownEvent.clientX;
    let currentWidth = startWidth;

    const handleMouseMove = (mouseMoveEvent: MouseEvent) => {
      const newWidth = startWidth + (mouseMoveEvent.clientX - startX);
      if (newWidth >= 160 && newWidth <= 400) {
        currentWidth = newWidth;
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      localStorage.setItem("sidebar-width", currentWidth.toString());
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Settings states
  const [configPath, setConfigPath] = useState(DEFAULT_CONFIG_PATH);
  const [theme, setTheme] = useState("dark");
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);
  const [detecting, setDetecting] = useState(false);

  // Dropdown smart flip
  const [dropdownDir, setDropdownDir] = useState<"down" | "up">("down");
  const [themeDropdownDir, setThemeDropdownDir] = useState<"up" | "down">("up");

  // Guards the load->save round-trip: setting `binds` from a disk read must
  // not immediately trigger a write back to that same file.
  const isReloadingRef = useRef(false);

  const presetByCommand = useMemo(
    () => new Map(commandPresets.map((p) => [p.command, p])),
    [commandPresets],
  );

  const descriptionFor = (command: string) =>
    presetByCommand.get(command)?.description ?? FALLBACK_DESCRIPTION;

  const nameFor = (command: string) => presetByCommand.get(command)?.name ?? command;

  useEffect(() => {
    invoke<CommandPreset[]>("get_known_commands")
      .then(setCommandPresets)
      .catch((err) => console.error("Не удалось загрузить словарь команд:", err));
  }, []);

  const loadFromPath = async (path: string) => {
    isReloadingRef.current = true;
    try {
      const loaded = await invoke<Bind[]>("read_keys_cfg", { path });
      setBinds(loaded);
      setStatusMessage(`Загружено биндов: ${loaded.length}`);
    } catch (err) {
      setStatusMessage(`Не удалось прочитать keys.cfg: ${err}`);
    } finally {
      isReloadingRef.current = false;
    }
  };

  const autoDetectConfigPath = async () => {
    setDetecting(true);
    try {
      const found = await invoke<string | null>("find_keys_cfg");
      if (found) {
        setConfigPath(found);
        await loadFromPath(found);
      } else {
        setStatusMessage("Не удалось найти keys.cfg автоматически.");
      }
      return found;
    } catch (err) {
      console.error("Автопоиск keys.cfg не удался:", err);
      return null;
    } finally {
      setDetecting(false);
    }
  };

  // Run auto-detection once on first launch so the config path (and its
  // binds) are already correct before the user ever opens Settings.
  useEffect(() => {
    autoDetectConfigPath();
  }, []);

  const handleAutoDetect = () => {
    autoDetectConfigPath();
  };

  const handleConfigPathChange = (path: string) => {
    setConfigPath(path);
    void loadFromPath(path);
  };

  const handleSelectFile = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".cfg";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const path = (file as any).path || `C:\\Program Files (x86)\\Steam\\steamapps\\common\\Rust\\cfg\\${file.name}`;
        handleConfigPathChange(path);
      }
    };
    input.click();
  };

  // Autosave: every bind change is written straight back to keys.cfg,
  // mirroring the previous WinUI app's save-on-change behaviour.
  useEffect(() => {
    if (isReloadingRef.current) return;
    if (binds.length === 0) return;

    invoke("write_keys_cfg", { path: configPath, binds }).catch((err) =>
      setStatusMessage(`Не удалось сохранить keys.cfg: ${err}`),
    );
  }, [binds, configPath]);

  const keyConflicts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const bind of binds) {
      if (!bind.key) continue;
      counts.set(bind.key, (counts.get(bind.key) ?? 0) + 1);
    }
    return counts;
  }, [binds]);

  const filteredBinds = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return binds;
    return binds.filter(
      (bind) =>
        bind.key.toLowerCase().includes(query) ||
        nameFor(bind.command).toLowerCase().includes(query) ||
        bind.command.toLowerCase().includes(query),
    );
  }, [binds, search, presetByCommand]);

  function addBind() {
    setBinds((prev) => [{ key: "", command: "" }, ...prev]);
  }

  function removeBind(bind: Bind) {
    setBinds((prev) => prev.filter((b) => b !== bind));
  }

  function updateBindCommand(index: number, newCommand: string) {
    setBinds((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], command: newCommand };
      return next;
    });
    changeOpenDropdown(null);
  }

  // Switches the open dropdown, keeping the previously open row elevated just
  // long enough for its own close animation so it never gets covered by a
  // newly opened dropdown or by a lower row's default stacking order.
  function changeOpenDropdown(next: number | null) {
    if (openDropdownIndex !== null && openDropdownIndex !== next) {
      const closingIndex = openDropdownIndex;
      setClosingDropdownIndex(closingIndex);
      if (closingDropdownTimeoutRef.current !== null) {
        window.clearTimeout(closingDropdownTimeoutRef.current);
      }
      closingDropdownTimeoutRef.current = window.setTimeout(() => {
        setClosingDropdownIndex((current) => (current === closingIndex ? null : current));
      }, 220);
    }
    setOpenDropdownIndex(next);
  }

  // Global listener for key rebinding
  useEffect(() => {
    if (editingKeyIndex === null) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();

      if (e.key === "Escape") {
        setEditingKeyIndex(null);
        return;
      }

      const keyName = keyNameFromEvent(e);

      setBinds((prev) => {
        const next = [...prev];
        next[editingKeyIndex] = { ...next[editingKeyIndex], key: keyName };
        return next;
      });
      setEditingKeyIndex(null);
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [editingKeyIndex]);

  // Global listener for click outside to close dropdowns
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".action-cell-container")) {
        changeOpenDropdown(null);
      }
      if (!target.closest(".theme-select-container")) {
        setThemeDropdownOpen(false);
      }
    };

    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, [openDropdownIndex]);

  useEffect(() => {
    return () => {
      if (closingDropdownTimeoutRef.current !== null) {
        window.clearTimeout(closingDropdownTimeoutRef.current);
      }
    };
  }, []);

  // Smart flip: open action dropdown upward if it overflows the viewport
  useLayoutEffect(() => {
    // Keep the last direction while closing so the fade-out plays the same
    // way it opened, instead of snapping back to "down".
    if (openDropdownIndex === null) return;
    const el = document.querySelector(".dropdown-menu.open") as HTMLElement | null;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setDropdownDir(rect.bottom > window.innerHeight - 8 ? "up" : "down");
  }, [openDropdownIndex]);

  // Smart flip: open theme dropdown downward if it overflows the top
  useLayoutEffect(() => {
    if (!themeDropdownOpen) {
      setThemeDropdownDir("up");
      return;
    }
    const el = document.querySelector(".theme-dropdown-menu.open") as HTMLElement | null;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setThemeDropdownDir(rect.top < 8 ? "down" : "up");
  }, [themeDropdownOpen]);

  function applyPreset(presetBinds: Bind[]) {
    setBinds(presetBinds);
    setActivePage("binds");
  }

  const activeIndex = NAV_ITEMS.findIndex((item) => item.id === activePage);

  return (
    <div className="app">
      <div className="sidebar" style={{ width: sidebarWidth }}>
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
        <div className="sidebar-resizer" onMouseDown={startResizing} />
      </div>

      <div className="main">
        {activePage === "binds" && (
          <div className="page-container binds-page">
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
              <div className="binds-body">
                {filteredBinds.map((bind, index) => {
                  const hasConflict = bind.key !== "" && (keyConflicts.get(bind.key) ?? 0) > 1;
                  const isDropdownOpen = openDropdownIndex === index;
                  const isDropdownClosing = closingDropdownIndex === index;
                  return (
                    <div
                      className={`bind-row ${isDropdownOpen ? "has-open-dropdown" : ""} ${isDropdownClosing ? "dropdown-closing" : ""}`}
                      key={`${bind.key}-${bind.command}-${index}`}
                    >
                      <div className="key-cell">
                        <div
                          className={`key-badge ${editingKeyIndex === index ? "editing" : ""} ${hasConflict ? "conflict" : ""}`}
                          onClick={() => setEditingKeyIndex(index)}
                          title={hasConflict ? "Эта клавиша уже используется другим биндом" : undefined}
                        >
                          {editingKeyIndex === index ? "Нажмите клавишу..." : bind.key || "—"}
                        </div>
                      </div>
                      <div className="action-cell-container">
                        <button
                          className="action-cell"
                          type="button"
                          title={descriptionFor(bind.command)}
                          onClick={() => changeOpenDropdown(openDropdownIndex === index ? null : index)}
                        >
                          {bind.command ? nameFor(bind.command) : "Выберите действие"}
                          <ChevronIcon />
                        </button>
                        <div className={`dropdown-menu ${openDropdownIndex === index ? "open" : ""} ${dropdownDir}`}>
                          {commandPresets.map((preset) => (
                            <button
                              key={preset.command}
                              className="dropdown-item"
                              type="button"
                              title={preset.description}
                              onClick={() => updateBindCommand(index, preset.command)}
                            >
                              {preset.name}
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

            {statusMessage && <div className="status-message">{statusMessage}</div>}
          </div>
        )}

        {activePage === "presets" && (
          <div className="presets-container page-container">
            <div className="presets-list">
              <div className="preset-card">
                <div className="preset-info">
                  <h3>По умолчанию</h3>
                  <p>Перечитать текущий keys.cfg с диска, отменив несохранённые правки.</p>
                </div>
                <button className="btn-preset-apply" onClick={() => loadFromPath(configPath)}>
                  Применить
                </button>
              </div>

              <div className="preset-card">
                <div className="preset-info">
                  <h3>PvP Набор</h3>
                  <p>Оптимизировано для боя: быстрое переключение на шприц, зажатое прицеливание.</p>
                </div>
                <button className="btn-preset-apply" onClick={() => applyPreset(PVP_PRESET)}>
                  Применить
                </button>
              </div>

              <div className="preset-card">
                <div className="preset-info">
                  <h3>Строительство</h3>
                  <p>Удобные клавиши для быстрого взаимодействия и апгрейда конструкций.</p>
                </div>
                <button className="btn-preset-apply" onClick={() => applyPreset(BUILDING_PRESET)}>
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
                  onChange={(e) => handleConfigPathChange(e.target.value)}
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
                  <div className={`theme-dropdown-menu ${themeDropdownOpen ? "open" : ""} ${themeDropdownDir}`}>
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
