import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { CommandPreset } from "./types";
import { useConfigFile } from "./hooks/useConfigFile";
import { keysCfgPathFor } from "./utils/paths";
import { useBindEditor } from "./hooks/useBindEditor";
import { useSidebarResize } from "./hooks/useSidebarResize";
import { ErrorBoundary } from "./components/ErrorBoundary";
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
  const [statusMessage, setStatusMessage] = useState<{
    type: "error" | "info";
    text: string;
  } | null>(null);
  const [commandPresets, setCommandPresets] = useState<CommandPreset[]>([]);
  const configFile = useConfigFile();
  const bindEditor = useBindEditor(commandPresets);
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
  const bindsLoaded = useRef(false);
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
            }
            bindsLoaded.current = true;
          })
          .catch((err) => {
            setStatusMessage({
              type: "error",
              text: `Не удалось прочитать keys.cfg: ${err}`,
            });
            bindsLoaded.current = true;
          });
      } else {
        setStatusMessage({
          type: "info",
          text: "Не удалось найти keys.cfg автоматически.",
        });
        bindsLoaded.current = true;
      }
    });
  }, []);

  // Load binds when gamePath changes (from user input or auto-detection)
  const handleGamePathChange = useCallback((path: string) => {
    configFile.setGamePath(path);
    configFile
      .loadFromPath(path)
      .then((loaded) => {
        if (loaded) {
          bindEditor.setBinds(loaded);
        }
      })
      .catch((err) => {
        setStatusMessage({
          type: "error",
          text: `Не удалось прочитать keys.cfg: ${err}`,
        });
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
            }
          })
          .catch((err) => {
            setStatusMessage({
              type: "error",
              text: `Не удалось прочитать keys.cfg: ${err}`,
            });
          });
      } else {
        setStatusMessage({
          type: "info",
          text: "Не удалось найти keys.cfg автоматически.",
        });
      }
    });
  }, []);

  // Autosave on bind change
  useEffect(() => {
    if (!bindsLoaded.current) return;
    if (configFile._isReloadingRef.current) return;
    invoke("write_keys_cfg", {
      path: keysCfgPathFor(configFile.gamePath),
      binds: bindEditor.binds,
    })
      .then(() => setStatusMessage(null))
      .catch((err) =>
        setStatusMessage({
          type: "error",
          text: `Не удалось сохранить keys.cfg: ${err}`,
        }),
      );
  }, [bindEditor.binds, configFile.gamePath]);

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
            <ErrorBoundary>
              <>
                <BindsPage
                  filteredBinds={bindEditor.filteredBinds}
                  displayBinds={bindEditor.displayBinds}
                  commandPresets={commandPresets}
                  search={bindEditor.search}
                  setSearch={bindEditor.setSearch}
                  addBind={bindEditor.addBind}
                  removeBind={bindEditor.removeBind}
                  confirmRemoveBind={bindEditor.confirmRemoveBind}
                  newBindIndex={bindEditor.newBindIndex}
                  setNewBindIndex={bindEditor.setNewBindIndex}
                  exitingBindIndex={bindEditor.exitingBindIndex}
                  keyConflicts={bindEditor.keyConflicts}
                  selectedKeys={bindEditor.selectedKeys}
                  nameFor={bindEditor.nameFor}
                  updateBind={bindEditor.updateBind}
                  handleKeyboardKey={bindEditor.handleKeyboardKey}
                />
                {statusMessage && (
                  <div
                    className={`status-message${statusMessage.type === "error" ? " status-error" : ""}`}
                  >
                    {statusMessage.text}
                  </div>
                )}
              </>
            </ErrorBoundary>
          )}

          {activePage === "tweaks" && (
            <ErrorBoundary>
              <TweaksPage gamePath={configFile.gamePath} />
            </ErrorBoundary>
          )}

          {activePage === "graphics" && (
            <ErrorBoundary>
              <GraphicsPage gamePath={configFile.gamePath} />
            </ErrorBoundary>
          )}

          {activePage === "settings" && (
            <ErrorBoundary>
              <SettingsPage
                gamePath={configFile.gamePath}
                setGamePath={handleGamePathChange}
                detecting={configFile.detecting}
                handleAutoDetect={handleAutoDetect}
                handleSelectFile={configFile.handleSelectFile}
              />
            </ErrorBoundary>
          )}
        </div>
      </div>
    </>
  );
}

export default App;
