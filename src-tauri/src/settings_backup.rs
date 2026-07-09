use crate::client_cfg;
use crate::steam;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;

const BACKUP_ROOT: &str = "game-settings-backups";
const MANIFEST_FILE: &str = "manifest.json";
const SETTINGS_FILES: [&str; 2] = ["keys.cfg", "client.cfg"];

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupFileStatus {
    pub name: String,
    pub backed_up: bool,
    pub source_exists: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupStatus {
    pub exists: bool,
    pub created_at_epoch_seconds: Option<u64>,
    pub backup_dir: String,
    pub files: Vec<BackupFileStatus>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct BackupManifest {
    game_path: String,
    config_dir: String,
    created_at_epoch_seconds: u64,
    files: Vec<String>,
}

#[tauri::command]
pub fn ensure_initial_game_settings_backup(
    app: tauri::AppHandle,
    game_path: String,
) -> Result<BackupStatus, String> {
    let paths = backup_paths(&app, &game_path)?;
    if paths.manifest.exists() {
        return backup_status_for_paths(&paths);
    }

    let copied_files = create_initial_backup(&paths, &game_path)?;
    if copied_files.is_empty() {
        return backup_status_for_paths(&paths);
    }

    let manifest = BackupManifest {
        game_path,
        config_dir: paths.config_dir.to_string_lossy().to_string(),
        created_at_epoch_seconds: unix_timestamp_now()?,
        files: copied_files,
    };
    let manifest_content = serde_json::to_string_pretty(&manifest)
        .map_err(|error| format!("Не удалось подготовить манифест бэкапа: {error}"))?
        + "\n";
    client_cfg::write_atomic(&paths.manifest, &manifest_content)?;

    backup_status_for_paths(&paths)
}

#[tauri::command]
pub fn get_game_settings_backup_status(
    app: tauri::AppHandle,
    game_path: String,
) -> Result<BackupStatus, String> {
    let paths = backup_paths(&app, &game_path)?;
    backup_status_for_paths(&paths)
}

#[tauri::command]
pub fn restore_game_settings_backup(
    app: tauri::AppHandle,
    game_path: String,
) -> Result<BackupStatus, String> {
    let paths = backup_paths(&app, &game_path)?;
    let manifest = read_manifest(&paths)?;

    let _guard = client_cfg::operation_lock()?;
    steam::unload_before_config_write()?;
    std::fs::create_dir_all(&paths.config_dir).map_err(|error| error.to_string())?;

    for file_name in manifest.files {
        let backup_file = paths.backup_dir.join(&file_name);
        let content = std::fs::read_to_string(&backup_file).map_err(|error| {
            format!(
                "Не удалось прочитать файл бэкапа {}: {error}",
                backup_file.display()
            )
        })?;
        client_cfg::write_atomic(&paths.config_dir.join(file_name), &content)?;
    }

    backup_status_for_paths(&paths)
}

struct BackupPaths {
    config_dir: PathBuf,
    backup_dir: PathBuf,
    manifest: PathBuf,
}

fn create_initial_backup(paths: &BackupPaths, game_path: &str) -> Result<Vec<String>, String> {
    let _guard = client_cfg::operation_lock()?;
    let mut copied_files = Vec::new();

    for file_name in SETTINGS_FILES {
        let source = paths.config_dir.join(file_name);
        if !source.exists() {
            log::info!(
                "settings backup source missing game_path={} file={}",
                game_path,
                source.display()
            );
            continue;
        }

        let content = std::fs::read_to_string(&source).map_err(|error| {
            format!(
                "Не удалось прочитать исходный файл {}: {error}",
                source.display()
            )
        })?;
        client_cfg::write_atomic(&paths.backup_dir.join(file_name), &content)?;
        copied_files.push(file_name.to_string());
    }

    Ok(copied_files)
}

fn backup_status_for_paths(paths: &BackupPaths) -> Result<BackupStatus, String> {
    let manifest = if paths.manifest.exists() {
        Some(read_manifest(paths)?)
    } else {
        None
    };

    let files = SETTINGS_FILES
        .iter()
        .map(|file_name| {
            let backed_up = manifest
                .as_ref()
                .map(|m| m.files.iter().any(|name| name == file_name))
                .unwrap_or(false)
                && paths.backup_dir.join(file_name).exists();
            BackupFileStatus {
                name: (*file_name).to_string(),
                backed_up,
                source_exists: paths.config_dir.join(file_name).exists(),
            }
        })
        .collect();

    Ok(BackupStatus {
        exists: manifest.is_some(),
        created_at_epoch_seconds: manifest.map(|m| m.created_at_epoch_seconds),
        backup_dir: paths.backup_dir.to_string_lossy().to_string(),
        files,
    })
}

fn read_manifest(paths: &BackupPaths) -> Result<BackupManifest, String> {
    let content = std::fs::read_to_string(&paths.manifest).map_err(|error| {
        format!(
            "Не удалось прочитать манифест бэкапа {}: {error}",
            paths.manifest.display()
        )
    })?;
    serde_json::from_str(&content).map_err(|error| {
        format!(
            "Не удалось разобрать манифест бэкапа {}: {error}",
            paths.manifest.display()
        )
    })
}

fn backup_paths<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    game_path: &str,
) -> Result<BackupPaths, String> {
    let config_dir = Path::new(game_path).join("cfg");
    let backup_key = stable_path_key(&config_dir)?;
    let backup_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join(BACKUP_ROOT)
        .join(backup_key);
    let manifest = backup_dir.join(MANIFEST_FILE);

    Ok(BackupPaths {
        config_dir,
        backup_dir,
        manifest,
    })
}

fn stable_path_key(path: &Path) -> Result<String, String> {
    let absolute = if path.exists() {
        std::fs::canonicalize(path).map_err(|error| error.to_string())?
    } else if path.is_absolute() {
        path.to_path_buf()
    } else {
        std::env::current_dir()
            .map_err(|error| error.to_string())?
            .join(path)
    };
    let raw = absolute.to_string_lossy();
    let normalized = raw
        .strip_prefix(r"\\?\")
        .unwrap_or(&raw)
        .replace('/', "\\")
        .to_lowercase();
    Ok(hex_encode(normalized.as_bytes()))
}

fn hex_encode(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        output.push(HEX[(byte >> 4) as usize] as char);
        output.push(HEX[(byte & 0x0f) as usize] as char);
    }
    output
}

fn unix_timestamp_now() -> Result<u64, String> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .map_err(|error| error.to_string())
}
