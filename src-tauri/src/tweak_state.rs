use crate::client_cfg;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use tauri::Manager;

const STATE_FILE_NAME: &str = "tweak-state.json";

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct StoredValue {
    pub value: Option<String>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActiveTweak {
    pub captured_values: BTreeMap<String, StoredValue>,
    pub desired_values: BTreeMap<String, String>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigState {
    pub baselines: BTreeMap<String, StoredValue>,
    pub active_tweaks: BTreeMap<String, ActiveTweak>,
    pub activation_order: Vec<String>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
pub struct TweakState {
    pub configs: BTreeMap<String, ConfigState>,
}

pub fn load(app: &tauri::AppHandle) -> Result<TweakState, String> {
    let path = state_path(app)?;
    let content = client_cfg::read(&path)?;
    if content.trim().is_empty() {
        return Ok(TweakState::default());
    }
    serde_json::from_str(&content).map_err(|error| {
        format!(
            "Не удалось прочитать состояние твиков {}: {error}",
            path.display()
        )
    })
}

pub fn save(app: &tauri::AppHandle, state: &TweakState) -> Result<(), String> {
    let path = state_path(app)?;
    let content = serde_json::to_string_pretty(state).map_err(|error| error.to_string())? + "\n";
    client_cfg::write_atomic(&path, &content).map_err(|error| {
        format!(
            "Не удалось сохранить состояние твиков {}: {error}",
            path.display()
        )
    })
}

pub fn config_key(path: &Path) -> Result<String, String> {
    // The key must be stable whether or not the target file already exists:
    // toggling a tweak on a still-absent client.cfg used to canonicalize the
    // path differently than the next run after the file was created, orphaning
    // the baselines and breaking the disable path ("Нет сохранённого значения").
    // Canonicalize the parent directory (which normally exists regardless) and
    // only fall back to lexical resolution when even the parent is missing.
    let parent = path.parent().filter(|p| !p.as_os_str().is_empty()).unwrap_or(path);
    let file_name = path
        .file_name()
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("client.cfg"));

    let canonical_parent = if parent.exists() {
        std::fs::canonicalize(parent).map_err(|error| error.to_string())?
    } else if parent.is_absolute() {
        parent.to_path_buf()
    } else {
        std::env::current_dir()
            .map_err(|error| error.to_string())?
            .join(parent)
    };

    let absolute = canonical_parent.join(file_name);
    let raw = absolute.to_string_lossy();
    // Strip the verbatim `\\?\` prefix Windows canonicalize() emits so the key
    // matches a path the user (or frontend) might supply without that prefix.
    let stripped = raw.strip_prefix(r"\\?\").unwrap_or(&raw);
    let normalized = stripped.replace('/', "\\");

    #[cfg(windows)]
    return Ok(normalized.to_lowercase());

    #[cfg(not(windows))]
    Ok(normalized)
}

fn state_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|directory| directory.join(STATE_FILE_NAME))
        .map_err(|error| error.to_string())
}
