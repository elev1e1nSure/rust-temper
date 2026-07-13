import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { BackupStatus, Bind, CommandPreset } from "./types";
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
import { OptimizationPage } from "./pages/OptimizationPage";
import { Titlebar } from "./Titlebar";
import { RustRunningGate } from "./components/RustRunningGate";
import { useRustRunning } from "./hooks/useRustRunning";
import type { PageId } from "./navigation";
import "./App.css";
import "./binds.css";

function presetKey(preset: CommandPreset): string {
  return [preset.kind, preset.command, preset.defaultMode, preset.name].join(
    ":",
  );
}

function dedupeCommandPresets(presets: CommandPreset[]): CommandPreset[] {
  const seen = new Set<string>();
  return presets.filter((preset) => {
    const key = presetKey(preset);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function App() {
  const [activePage, setActivePage] = useState<PageId>("binds");
  const [statusMessage, setStatusMessage] = useState<{
    type: "error" | "info";
    text: string;
  } | null>(null);
  const [isLoadingBinds, setIsLoadingBinds] = useState(true);
  const [commandPresets, setCommandPresets] = useState<CommandPreset[]>([]);
  const [backupRefreshKey, setBackupRefreshKey] = useState(0);
  const configFile = useConfigFile();
  const bindEditor = useBindEditor(commandPresets);
  const { sidebarWidth, startResizing } = useSidebarResize();
  const rustRunning = useRustRunning();
  const { loadFromPath, setGamePath } = configFile;
  const { setBinds } = bindEditor;

  // Load command dictionary
  useEffect(() => {
    invoke<CommandPreset[]>("get_known_commands")
      .then((presets) => setCommandPresets(dedupeCommandPresets(presets)))
      .catch((err) =>
        console.error("Не удалось загрузить словарь команд:", err),
      );
  }, []);

  // Auto-detect config path once on first launch (guarded against React strict mode double-mount)
  const autoDetectRan = useRef(false);
  const bindsLoaded = useRef(false);
  const pathActionVersion = useRef(0);
  const autosaveVersion = useRef(0);
  const autosaveQueue = useRef<Promise<void>>(Promise.resolve());
  const autosaveTimer = useRef<number | null>(null);
  const pendingAutosave = useRef<{
    version: number;
    path: string;
    binds: Bind[];
  } | null>(null);

  const enqueuePendingAutosave = useCallback(() => {
    const pending = pendingAutosave.current;
    if (!pending) return;
    pendingAutosave.current = null;

    const save = autosaveQueue.current
      .catch(() => undefined)
      .then(() =>
        invoke<void>("write_keys_cfg", {
          path: pending.path,
          binds: pending.binds,
        }),
      );
    autosaveQueue.current = save.catch(() => undefined);
    save
      .then(() => {
        if (autosaveVersion.current === pending.version) {
          setStatusMessage(null);
        }
      })
      .catch((err) => {
        if (autosaveVersion.current === pending.version) {
          setStatusMessage({
            type: "error",
            text: `Не удалось сохранить keys.cfg: ${err}`,
          });
        }
      });
  }, []);

  const flushAutosave = useCallback(async () => {
    if (autosaveTimer.current !== null) {
      window.clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    }
    enqueuePendingAutosave();
    await autosaveQueue.current;
  }, [enqueuePendingAutosave]);

  const loadGamePath = useCallback(
    async (
      path: string,
      actionVersion: number,
    ): Promise<"loaded" | "stale" | "error"> => {
      setIsLoadingBinds(true);

      try {
        const loaded = await loadFromPath(path);
        if (pathActionVersion.current !== actionVersion) return "stale";
        setBinds(loaded);
        setGamePath(path);
        bindsLoaded.current = true;
        setStatusMessage(null);
        return "loaded";
      } catch (err) {
        if (pathActionVersion.current === actionVersion) {
          setStatusMessage({
            type: "error",
            text: `Не удалось прочитать keys.cfg: ${err}`,
          });
        }
        return pathActionVersion.current === actionVersion ? "error" : "stale";
      } finally {
        if (pathActionVersion.current === actionVersion) {
          setIsLoadingBinds(false);
        }
      }
    },
    [loadFromPath, setBinds, setGamePath],
  );

  useEffect(() => {
    if (autoDetectRan.current) return;
    autoDetectRan.current = true;
    const actionVersion = pathActionVersion.current + 1;
    pathActionVersion.current = actionVersion;
    configFile.autoDetectConfigPath().then((found) => {
      if (pathActionVersion.current !== actionVersion) return;
      if (found) {
        void loadGamePath(found, actionVersion);
      } else {
        setStatusMessage({
          type: "info",
          text: "Не удалось найти keys.cfg автоматически.",
        });
        bindsLoaded.current = true;
        setIsLoadingBinds(false);
      }
    });
  }, [configFile, loadGamePath]);

  const handleGamePathChange = useCallback(
    (path: string) => {
      const actionVersion = pathActionVersion.current + 1;
      pathActionVersion.current = actionVersion;
      return loadGamePath(path, actionVersion);
    },
    [loadGamePath],
  );

  const prepareConfigRestore = useCallback(async () => {
    pathActionVersion.current += 1;
    await flushAutosave();
  }, [flushAutosave]);

  const reloadBindsAfterRestore = useCallback(
    async (restoredPath: string) => {
      if (restoredPath !== configFile.gamePath) return;
      await loadGamePath(restoredPath, pathActionVersion.current);
    },
    [configFile.gamePath, loadGamePath],
  );

  useEffect(() => {
    if (!configFile.gamePath) return;
    let cancelled = false;

    invoke<BackupStatus>("ensure_initial_game_settings_backup", {
      gamePath: configFile.gamePath,
    })
      .then(() => {
        if (!cancelled) {
          setBackupRefreshKey((key) => key + 1);
        }
      })
      .catch((err) => {
        console.error("Не удалось создать первичный бэкап настроек:", err);
      });

    return () => {
      cancelled = true;
    };
  }, [configFile.gamePath]);

  // User-triggered auto-detection
  const handleAutoDetect = useCallback(() => {
    const actionVersion = pathActionVersion.current + 1;
    pathActionVersion.current = actionVersion;
    configFile.autoDetectConfigPath().then((found) => {
      if (pathActionVersion.current !== actionVersion) return;
      if (found) {
        void loadGamePath(found, actionVersion);
      } else {
        setStatusMessage({
          type: "info",
          text: "Не удалось найти keys.cfg автоматически.",
        });
      }
    });
  }, [configFile, loadGamePath]);

  const handleSelectPath = useCallback(async () => {
    const actionVersion = pathActionVersion.current + 1;
    pathActionVersion.current = actionVersion;
    const selected = await configFile.selectGamePath();
    if (selected && pathActionVersion.current === actionVersion) {
      await loadGamePath(selected, actionVersion);
    }
  }, [configFile, loadGamePath]);

  // Autosave on bind change
  useEffect(() => {
    if (!bindsLoaded.current) return;

    const version = autosaveVersion.current + 1;
    autosaveVersion.current = version;
    pendingAutosave.current = {
      version,
      path: keysCfgPathFor(configFile.gamePath),
      binds: bindEditor.binds,
    };
    autosaveTimer.current = window.setTimeout(() => {
      autosaveTimer.current = null;
      enqueuePendingAutosave();
    }, 200);

    return () => {
      if (autosaveTimer.current !== null) {
        window.clearTimeout(autosaveTimer.current);
        autosaveTimer.current = null;
      }
    };
  }, [bindEditor.binds, configFile.gamePath, enqueuePendingAutosave]);

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
                  occupiedKeys={bindEditor.occupiedKeys}
                  isLoading={isLoadingBinds}
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

          {activePage === "optimization" && (
            <ErrorBoundary>
              <OptimizationPage />
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
                handleSelectFile={handleSelectPath}
                backupRefreshKey={backupRefreshKey}
                onBeforeConfigRestore={prepareConfigRestore}
                onConfigRestored={reloadBindsAfterRestore}
              />
            </ErrorBoundary>
          )}
        </div>
      </div>
      <RustRunningGate running={rustRunning} />
    </>
  );
}

export default App;
