use serde::{Deserialize, Serialize};

/// keys.cfg only ever contains bind lines in this game, so the file is
/// fully regenerated from the in-memory bind list on every save.
/// Rust does not quote the key token; the command is the raw remainder of
/// the line and may itself contain quotes, ";" (multi-commands) or a
/// leading "~" (toggle binds) — it is kept verbatim, never re-parsed.
#[derive(Serialize, Deserialize, Clone)]
pub struct KeyBind {
    pub key: String,
    pub command: String,
}

fn parse_bind_line(line: &str) -> Option<KeyBind> {
    let rest = line.trim().strip_prefix("bind")?;
    let rest = rest.strip_prefix(char::is_whitespace)?.trim_start();

    let mut parts = rest.splitn(2, char::is_whitespace);
    let key = parts.next()?.to_string();
    if key.is_empty() {
        return None;
    }
    let command = parts.next().unwrap_or("").trim_start().to_string();

    Some(KeyBind { key, command })
}

#[tauri::command]
pub fn read_keys_cfg(path: String) -> Result<Vec<KeyBind>, String> {
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    Ok(content.lines().filter_map(parse_bind_line).collect())
}

#[tauri::command]
pub fn write_keys_cfg(path: String, binds: Vec<KeyBind>) -> Result<(), String> {
    if binds.is_empty() {
        return Ok(());
    }

    let backup_path = format!("{path}.bak");
    if !std::path::Path::new(&backup_path).exists() {
        std::fs::copy(&path, &backup_path).map_err(|e| e.to_string())?;
    }

    let mut content = String::new();
    for bind in &binds {
        content.push_str("bind ");
        content.push_str(&bind.key);
        content.push(' ');
        content.push_str(&bind.command);
        content.push('\n');
    }

    std::fs::write(&path, content).map_err(|e| e.to_string())
}
