import { useEffect, useState } from "react";
import { LoadingLine } from "@mingcute/react";
import { invoke } from "@tauri-apps/api/core";
import type { BackupStatus } from "../types";
import "./SettingsPage.css";

interface SettingsPageProps {
  gamePath: string;
  setGamePath: (path: string) => void;
  detecting: boolean;
  handleAutoDetect: () => void;
  handleSelectFile: () => void;
  backupRefreshKey: number;
  onConfigRestored: () => Promise<void>;
}

export function SettingsPage({
  gamePath,
  setGamePath,
  detecting,
  handleAutoDetect,
  handleSelectFile,
  backupRefreshKey,
  onConfigRestored,
}: SettingsPageProps) {
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

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
      const restored = await invoke<BackupStatus>(
        "restore_game_settings_backup",
        {
          gamePath,
        },
      );
      setBackupStatus(restored);
      await onConfigRestored();
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

      <div className="settings-card backup-card">
        <div>
          <div className="setting-label">Первичный бэкап настроек</div>
          <p className="backup-description">
            Этот бэкап создаётся один раз при первом запуске программы с
            найденной папкой Rust. Он хранит исходные keys.cfg и client.cfg,
            если они уже есть в папке игры, чтобы можно было откатиться, если
            изменения пошли не так.
          </p>
        </div>

        <div className="backup-actions">
          <button
            type="button"
            className="btn-restore-backup"
            disabled={!backupStatus?.exists || restoring}
            onClick={restoreBackup}
          >
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
  );
}
