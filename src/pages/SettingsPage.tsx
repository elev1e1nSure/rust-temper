import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { LoadingLine } from "@mingcute/react";
import { invoke } from "@tauri-apps/api/core";
import {
  AutoDetectIcon,
  ChevronIcon,
  FolderOpenIcon,
  RestoreBackupIcon,
  ShieldIcon,
} from "../icons";
import type { BackupStatus } from "../types";
import "./SettingsPage.css";

interface SettingsPageProps {
  gamePath: string;
  setGamePath: (path: string) => Promise<"loaded" | "stale" | "error">;
  detecting: boolean;
  handleAutoDetect: () => void;
  handleSelectFile: () => void;
  backupRefreshKey: number;
  onBeforeConfigRestore: () => Promise<void>;
  onConfigRestored: (path: string) => Promise<void>;
}

export function SettingsPage({
  gamePath,
  setGamePath,
  detecting,
  handleAutoDetect,
  handleSelectFile,
  backupRefreshKey,
  onBeforeConfigRestore,
  onConfigRestored,
}: SettingsPageProps) {
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [backupExpanded, setBackupExpanded] = useState(true);
  const backupInnerRef = useRef<HTMLDivElement | null>(null);
  const [backupHeight, setBackupHeight] = useState(0);
  const [backupShouldAnimate, setBackupShouldAnimate] = useState(false);
  const [gamePathDraft, setGamePathDraft] = useState(gamePath);

  useEffect(() => {
    setGamePathDraft(gamePath);
  }, [gamePath]);

  const commitGamePath = async () => {
    const path = gamePathDraft.trim();
    if (!path || path === gamePath) return;
    const result = await setGamePath(path);
    if (result !== "loaded") setGamePathDraft(gamePath);
  };

  useLayoutEffect(() => {
    const el = backupInnerRef.current;
    if (!el) return;
    setBackupHeight(backupExpanded ? el.scrollHeight : 0);
    if (!backupExpanded) return;
    const observer = new ResizeObserver(() => {
      setBackupHeight(el.scrollHeight);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [backupExpanded]);

  useEffect(() => {
    if (!gamePath) return;
    let cancelled = false;

    invoke<BackupStatus>("get_game_settings_backup_status", { gamePath })
      .then((status) => {
        if (!cancelled) {
          setBackupStatus(status);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setRestoreMessage({
            type: "error",
            text: `Не удалось проверить бэкап: ${err}`,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [gamePath, backupRefreshKey]);

  const restoreBackup = async () => {
    if (!backupStatus?.exists || restoring) return;
    setRestoring(true);
    setRestoreMessage(null);

    try {
      await onBeforeConfigRestore();
      const restored = await invoke<BackupStatus>(
        "restore_game_settings_backup",
        {
          gamePath,
        },
      );
      setBackupStatus(restored);
      await onConfigRestored(gamePath);
      setRestoreMessage({
        type: "success",
        text: "Бэкап восстановлен. keys.cfg и client.cfg возвращены к первому сохранённому состоянию.",
      });
    } catch (err) {
      setRestoreMessage({
        type: "error",
        text: `Не удалось восстановить бэкап: ${err}`,
      });
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="settings-container page-container">
      <div className="settings-card">
        <div className="setting-group">
          <label className="setting-label">Путь к игре (Rust)</label>
          <input
            type="text"
            className="setting-input"
            value={gamePathDraft}
            onChange={(e) => setGamePathDraft(e.target.value)}
            onBlur={() => void commitGamePath()}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") {
                setGamePathDraft(gamePath);
                event.currentTarget.blur();
              }
            }}
          />
          <div className="path-actions">
            <button
              type="button"
              className={`btn-path${detecting ? " detecting" : ""}`}
              onClick={handleAutoDetect}
              disabled={detecting}
            >
              <span className="action-icon" aria-hidden="true">
                {detecting ? <LoadingLine size={14} /> : <AutoDetectIcon />}
              </span>
              {detecting ? "Поиск..." : "Автоопределение"}
            </button>
            <button
              type="button"
              className="btn-path"
              onClick={handleSelectFile}
            >
              <span className="action-icon" aria-hidden="true">
                <FolderOpenIcon />
              </span>
              Выбрать папку
            </button>
          </div>
        </div>
      </div>

      <div className="accordion-section">
        <button
          type="button"
          className="accordion-header"
          onClick={() => {
            setBackupShouldAnimate(true);
            setBackupExpanded((prev) => !prev);
          }}
          aria-expanded={backupExpanded}
        >
          <span className="accordion-title">
            <span
              className="action-icon accordion-title-icon"
              aria-hidden="true"
            >
              <ShieldIcon />
            </span>
            Первичный бэкап настроек
          </span>
          <span className={`accordion-arrow${backupExpanded ? " open" : ""}`}>
            <ChevronIcon />
          </span>
        </button>
        <div
          className="accordion-content"
          style={{
            height: backupHeight,
            transition: backupShouldAnimate ? undefined : "none",
          }}
        >
          <div className="accordion-content-inner" ref={backupInnerRef}>
            <div className="backup-body">
              <p className="backup-description">
                Этот бэкап создаётся один раз при первом запуске программы с
                найденной папкой Rust. Он хранит исходные keys.cfg и client.cfg,
                если они уже есть в папке игры, чтобы можно было откатиться,
                если что то пошло не так.
              </p>

              <div className="backup-actions">
                <button
                  type="button"
                  className="btn-restore-backup"
                  disabled={!backupStatus?.exists || restoring}
                  onClick={restoreBackup}
                >
                  <span className="action-icon" aria-hidden="true">
                    <RestoreBackupIcon />
                  </span>
                  {restoring ? "Восстановление..." : "Восстановить бэкап"}
                </button>
              </div>

              {restoreMessage && (
                <div
                  className={`backup-message${restoreMessage.type === "error" ? " error" : ""}`}
                >
                  {restoreMessage.text}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
