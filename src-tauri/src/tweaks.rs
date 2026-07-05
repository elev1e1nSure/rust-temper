use serde::Serialize;
use std::collections::{HashMap, HashSet};

#[derive(Serialize, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum TweakValueType {
    Bool { on: String, off: String },
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TweakDef {
    pub key: String,
    pub title: String,
    pub description: String,
    pub value_type: TweakValueType,
    pub default: String,
}

fn known_tweaks() -> Vec<TweakDef> {
    vec![TweakDef {
        key: "legs.enablelegs".to_string(),
        title: "Показывать ноги".to_string(),
        description: "Отключает отображение ног персонажа от первого лица.".to_string(),
        value_type: TweakValueType::Bool {
            on: "1".to_string(),
            off: "0".to_string(),
        },
        default: "1".to_string(),
    }]
}

#[tauri::command]
pub fn get_known_tweaks() -> Vec<TweakDef> {
    known_tweaks()
}

fn split_key_value(line: &str) -> Option<(&str, &str)> {
    let trimmed = line.trim();
    let split_pos = trimmed.find(char::is_whitespace)?;
    Some((&trimmed[..split_pos], trimmed[split_pos..].trim()))
}

/// client.cfg may contain arbitrary user settings unrelated to tweaks, so only
/// lines matching a known tweak key are surfaced here — everything else is
/// left untouched by write_tweak below.
#[tauri::command]
pub fn read_client_cfg(path: String) -> Result<HashMap<String, String>, String> {
    let content = match std::fs::read_to_string(&path) {
        Ok(c) => c,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(HashMap::new()),
        Err(e) => return Err(e.to_string()),
    };

    let tweaks = known_tweaks();
    let known_keys: HashSet<&str> = tweaks.iter().map(|t| t.key.as_str()).collect();
    let mut values = HashMap::new();
    for line in content.lines() {
        if let Some((key, value)) = split_key_value(line) {
            if known_keys.contains(key) {
                values.insert(key.to_string(), value.to_string());
            }
        }
    }
    Ok(values)
}

#[tauri::command]
pub fn write_tweak(path: String, key: String, value: String) -> Result<(), String> {
    let p = std::path::Path::new(&path);
    if let Some(parent) = p.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let content = std::fs::read_to_string(&path).unwrap_or_default();
    let new_line = format!("{key} {value}");

    let mut found = false;
    let mut lines: Vec<String> = content
        .lines()
        .map(|line| match split_key_value(line) {
            Some((existing_key, _)) if existing_key == key => {
                found = true;
                new_line.clone()
            }
            _ => line.to_string(),
        })
        .collect();

    if !found {
        lines.push(new_line);
    }

    if p.exists() {
        let backup_path = format!("{path}.bak");
        std::fs::copy(&path, &backup_path).map_err(|e| e.to_string())?;
    }

    std::fs::write(&path, lines.join("\n") + "\n").map_err(|e| e.to_string())
}
