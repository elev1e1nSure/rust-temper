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

pub fn load<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> Result<TweakState, String> {
    let path = state_path(app)?;
    let content = client_cfg::read(&path)?;
    deserialize_state(&content).map_err(|error| {
        format!(
            "Не удалось прочитать состояние твиков {}: {error}",
            path.display()
        )
    })
}

pub fn save<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    state: &TweakState,
) -> Result<(), String> {
    let path = state_path(app)?;
    let content = serialize_state(state).map_err(|error| {
        format!(
            "Не удалось сохранить состояние твиков {}: {error}",
            path.display()
        )
    })?;
    client_cfg::write_atomic(&path, &content)
}

pub(crate) fn deserialize_state(content: &str) -> Result<TweakState, String> {
    if content.trim().is_empty() {
        return Ok(TweakState::default());
    }
    serde_json::from_str(content).map_err(|error| error.to_string())
}

pub(crate) fn serialize_state(state: &TweakState) -> Result<String, String> {
    Ok(serde_json::to_string_pretty(state).map_err(|error| error.to_string())? + "\n")
}

pub fn config_key(path: &Path) -> Result<String, String> {
    // The key must be stable whether or not the target file already exists:
    // toggling a tweak on a still-absent client.cfg used to canonicalize the
    // path differently than the next run after the file was created, orphaning
    // the baselines and breaking the disable path ("Нет сохранённого значения").
    // Canonicalize the parent directory (which normally exists regardless) and
    // only fall back to lexical resolution when even the parent is missing.
    let parent = path
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .unwrap_or(path);
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

fn state_path<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|directory| directory.join(STATE_FILE_NAME))
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── config_key ────────────────────────────────────────────────────────────

    #[test]
    fn config_key_existing_file() {
        let dir = std::env::temp_dir().join(format!("tweak_state_test_{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("client.cfg");
        std::fs::write(&path, b"").unwrap();
        let key = config_key(&path).unwrap();
        #[cfg(windows)]
        {
            let expected = std::fs::canonicalize(&dir)
                .unwrap()
                .join("client.cfg")
                .to_string_lossy()
                .replace(r"\\?\", "")
                .to_lowercase();
            assert_eq!(key, expected);
        }
        #[cfg(not(windows))]
        {
            let expected = std::fs::canonicalize(&dir)
                .unwrap()
                .join("client.cfg")
                .to_string_lossy()
                .to_string();
            assert_eq!(key, expected);
        }
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn config_key_nonexistent_parent_uses_absolute() {
        let dir = std::env::temp_dir().join(format!("nonexistent_parent_{}", std::process::id()));
        let path = dir.join("client.cfg");
        let key = config_key(&path).unwrap();
        assert!(key.contains("client.cfg"));
    }

    #[test]
    fn config_key_relative_path() {
        // Relative path with nonexistent parent should resolve via cwd
        let key = config_key(Path::new("relative/path/client.cfg")).unwrap();
        assert!(key.contains("client.cfg"));
        assert!(key.contains("relative"));
    }

    // ── Serialization round-trip ──────────────────────────────────────────────

    #[test]
    fn tweak_state_default() {
        let state = TweakState::default();
        assert!(state.configs.is_empty());
    }

    #[test]
    fn active_tweak_round_trip_json() {
        let tweak = ActiveTweak {
            captured_values: [(
                "graphics.fov".into(),
                StoredValue {
                    value: Some("90".into()),
                },
            )]
            .into(),
            desired_values: [("graphics.fov".into(), "70".into())].into(),
        };
        let json = serde_json::to_string(&tweak).unwrap();
        let deserialized: ActiveTweak = serde_json::from_str(&json).unwrap();
        assert_eq!(
            deserialized
                .captured_values
                .get("graphics.fov")
                .unwrap()
                .value,
            Some("90".into())
        );
        assert_eq!(
            deserialized.desired_values.get("graphics.fov").unwrap(),
            "70"
        );
    }

    #[test]
    fn config_state_round_trip_json() {
        let state = ConfigState {
            baselines: [(
                "graphics.fov".into(),
                StoredValue {
                    value: Some("90".into()),
                },
            )]
            .into(),
            active_tweaks: [(
                "disableParasiticParams".into(),
                ActiveTweak {
                    captured_values: BTreeMap::new(),
                    desired_values: [("global.showblood".into(), "False".into())].into(),
                },
            )]
            .into(),
            activation_order: vec!["disableParasiticParams".into()],
        };
        let json = serde_json::to_string_pretty(&state).unwrap();
        let deserialized: ConfigState = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.activation_order.len(), 1);
    }

    #[test]
    fn tweak_state_round_trip_json() {
        let state = TweakState {
            configs: [(
                r"d:\games\rust\cfg\client.cfg".into(),
                ConfigState {
                    baselines: BTreeMap::new(),
                    active_tweaks: BTreeMap::new(),
                    activation_order: vec![],
                },
            )]
            .into(),
        };
        let json = serde_json::to_string(&state).unwrap();
        let deserialized: TweakState = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.configs.len(), 1);
    }

    #[test]
    fn stored_value_none_round_trip() {
        let sv = StoredValue { value: None };
        let json = serde_json::to_string(&sv).unwrap();
        let deserialized: StoredValue = serde_json::from_str(&json).unwrap();
        assert!(deserialized.value.is_none());
    }

    // ── serialize_state / deserialize_state ──────────────────────────────────

    #[test]
    fn serialize_then_deserialize_round_trip() {
        let state = TweakState {
            configs: [(
                r"d:\games\cfg\client.cfg".into(),
                ConfigState {
                    baselines: [(
                        "graphics.fov".into(),
                        StoredValue {
                            value: Some("90".into()),
                        },
                    )]
                    .into(),
                    active_tweaks: [(
                        "disableParasiticParams".into(),
                        ActiveTweak {
                            captured_values: BTreeMap::new(),
                            desired_values: [("global.showblood".into(), "False".into())].into(),
                        },
                    )]
                    .into(),
                    activation_order: vec!["disableParasiticParams".into()],
                },
            )]
            .into(),
        };
        let serialized = serialize_state(&state).unwrap();
        let deserialized = deserialize_state(&serialized).unwrap();
        assert_eq!(deserialized.configs.len(), 1);
        let cfg = deserialized
            .configs
            .get(r"d:\games\cfg\client.cfg")
            .unwrap();
        assert!(!cfg.activation_order.is_empty());
        assert_eq!(
            cfg.baselines.get("graphics.fov").unwrap().value,
            Some("90".into())
        );
    }

    #[test]
    fn deserialize_empty_content_returns_default() {
        let result = deserialize_state("").unwrap();
        assert!(result.configs.is_empty());
    }

    #[test]
    fn deserialize_whitespace_content_returns_default() {
        let result = deserialize_state("  \n  ").unwrap();
        assert!(result.configs.is_empty());
    }

    #[test]
    fn deserialize_invalid_json_returns_error() {
        let result = deserialize_state("not json");
        assert!(result.is_err());
    }

    #[test]
    fn serialize_default_state() {
        let result = serialize_state(&TweakState::default()).unwrap();
        // Should be valid JSON
        let parsed: serde_json::Value = serde_json::from_str(&result).unwrap();
        assert_eq!(parsed["configs"], serde_json::json!({}));
    }
}
