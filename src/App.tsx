import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { CommandPreset } from "./types";
import { useConfigFile } from "./hooks/useConfigFile";
import { useBindEditor } from "./hooks/useBindEditor";
import { useDropdownBehavior } from "./hooks/useDropdownBehavior";
import { useSidebarResize } from "./hooks/useSidebarResize";
import { Sidebar } from "./components/Sidebar";
import { BindsPage } from "./pages/BindsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { GraphicsPage } from "./pages/GraphicsPage";
import { TweaksPage } from "./pages/TweaksPage";
import { Titlebar } from "./Titlebar";
import type { PageId } from "./navigation";
import "./App.css";
import "./binds.css";

function App() {
  const [activePage, setActivePage] = useState<PageId>("binds");
  const [statusMessage, setStatusMessage] = useState("");
  const [commandPresets, setCommandPresets] = useState<CommandPreset[]>([]);
  const [theme, setTheme] = useState("dark");
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);
  const [themeDropdownDir, setThemeDropdownDir] = useState<"up" | "down">("up");

  const configFile = useConfigFile();
  const bindEditor = useBindEditor(commandPresets);
  const dropdown = useDropdownBehavior(commandPresets);
  const { sidebarWidth, startResizing } = useSidebarResize();

  // Load command dictionary
  useEffect(() => {
    invoke<CommandPreset[]>("get_known_commands")
      .then(setCommandPresets)
      .catch((err) =>
        console.error("Не удалось загрузить словарь команд:", err),
      );
  }, []);

  // Auto-detect config path once on first launch (guarded against React strict mode double-mount)
  const autoDetectRan = useRef(false);
  useEffect(() => {
    if (autoDetectRan.current) return;
    autoDetectRan.current = true;
    configFile.autoDetectConfigPath().then((found) => {
      if (found) {
        configFile
          .loadFromPath(found)
          .then((loaded) => {
            if (loaded) {
              bindEditor.setBinds(loaded);
              setStatusMessage(`${loaded.length} биндов`);
            }
          })
          .catch((err) => {
            setStatusMessage(`Не удалось прочитать keys.cfg: ${err}`);
          });
      } else {
        setStatusMessage("Не удалось найти keys.cfg автоматически.");
      }
    });
  }, []);

  // Load binds when configPath changes (from user input or auto-detection)
  const handleConfigPathChange = useCallback((path: string) => {
    configFile.setConfigPath(path);
    configFile
      .loadFromPath(path)
      .then((loaded) => {
        if (loaded) {
          bindEditor.setBinds(loaded);
          setStatusMessage(`${loaded.length} биндов`);
        }
      })
      .catch((err) => {
        setStatusMessage(`Не удалось прочитать keys.cfg: ${err}`);
      });
  }, []);

  // User-triggered auto-detection
  const handleAutoDetect = useCallback(() => {
    configFile.autoDetectConfigPath().then((found) => {
      if (found) {
        configFile
          .loadFromPath(found)
          .then((loaded) => {
            if (loaded) {
              bindEditor.setBinds(loaded);
              setStatusMessage(`${loaded.length} биндов`);
            }
          })
          .catch((err) => {
            setStatusMessage(`Не удалось прочитать keys.cfg: ${err}`);
          });
      } else {
        setStatusMessage("Не удалось найти keys.cfg автоматически.");
      }
    });
  }, []);

  // Autosave on bind change
  useEffect(() => {
    if (configFile.isReloadingRef.current) return;
    if (bindEditor.binds.length === 0) return;
    invoke("write_keys_cfg", {
      path: configFile.configPath,
      binds: bindEditor.binds,
    }).catch((err) =>
      setStatusMessage(`Не удалось сохранить keys.cfg: ${err}`),
    );
  }, [bindEditor.binds, configFile.configPath]);

  // Close theme dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".theme-select-container")) {
        setThemeDropdownOpen(false);
      }
    };
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, []);

  return (
    <>
      <Titlebar />
      <div className="app">
        <Sidebar
          activePage={activePage}
          onNavigate={setActivePage}
          sidebarWidth={sidebarWidth}
          onStartResizing={startResizing}
        />

        <div className="main">
          {activePage === "binds" && (
            <>
              <BindsPage
                filteredBinds={bindEditor.filteredBinds}
                commandPresets={commandPresets}
                search={bindEditor.search}
                setSearch={bindEditor.setSearch}
                addBind={bindEditor.addBind}
                addFromPreset={bindEditor.addFromPreset}
                removeBind={bindEditor.removeBind}
                confirmRemoveBind={bindEditor.confirmRemoveBind}
                editingKeyIndex={bindEditor.editingKeyIndex}
                setEditingKeyIndex={bindEditor.setEditingKeyIndex}
                newBindIndex={bindEditor.newBindIndex}
                setNewBindIndex={bindEditor.setNewBindIndex}
                exitingBindIndex={bindEditor.exitingBindIndex}
                keyConflicts={bindEditor.keyConflicts}
                selectedKeys={bindEditor.selectedKeys}
                setSelectedKeys={bindEditor.setSelectedKeys}
                nameFor={bindEditor.nameFor}
                updateBindCommand={bindEditor.updateBindCommand}
                handleKeyboardKey={bindEditor.handleKeyboardKey}
                openDropdownIndex={dropdown.openDropdownIndex}
                closingDropdownIndex={dropdown.closingDropdownIndex}
                changeOpenDropdown={dropdown.changeOpenDropdown}
                commandSearch={dropdown.commandSearch}
                setCommandSearch={dropdown.setCommandSearch}
                filteredCommandPresets={dropdown.filteredCommandPresets}
                dropdownDir={dropdown.dropdownDir}
                setDropdownDir={dropdown.setDropdownDir}
                filterKind={dropdown.filterKind}
                setFilterKind={dropdown.setFilterKind}
              />
              {statusMessage && (
                <div className="status-message">{statusMessage}</div>
              )}
            </>
          )}

          {activePage === "tweaks" && (
            <TweaksPage configPath={configFile.configPath} />
          )}

          {activePage === "graphics" && <GraphicsPage />}

          {activePage === "settings" && (
            <SettingsPage
              configPath={configFile.configPath}
              setConfigPath={handleConfigPathChange}
              detecting={configFile.detecting}
              handleAutoDetect={handleAutoDetect}
              handleSelectFile={configFile.handleSelectFile}
              theme={theme}
              themeDropdownOpen={themeDropdownOpen}
              themeDropdownDir={themeDropdownDir}
              setThemeDropdownDir={setThemeDropdownDir}
              setThemeDropdownOpen={setThemeDropdownOpen}
              setTheme={setTheme}
            />
          )}
        </div>
      </div>
    </>
  );
}

export default App;
