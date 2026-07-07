use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::Path;

use crate::client_cfg;

pub fn load_binds(path: &Path) -> Result<Vec<KeyBind>, String> {
    let content = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    Ok(content.lines().filter_map(parse_bind_line).collect())
}

/// keys.cfg may contain bind lines, comments (`//`/`#`), blank lines and other
/// directives. Earlier the file was wholesale regenerated as only `bind` lines,
/// silently destroying everything else. We now treat it as opaque: surgically
/// edit only the lines we own.
#[derive(Serialize, Deserialize, Clone)]
pub struct KeyBind {
    pub key: String,
    pub command: String,
}

/// Surgically set or remove a single bind in the existing file content.
/// `command = Some(cmd)` replaces the last bind line for `key` (or appends),
/// preserving every other line verbatim. `command = None` removes the last
/// bind line for `key`. Inline comments and non-`bind` lines are preserved.
pub fn apply_bind(content: &str, key: &str, command: Option<&str>) -> String {
    let newline = detect_newline(content);
    let mut lines: Vec<String> = content.lines().map(str::to_string).collect();

    let last_idx = lines
        .iter()
        .enumerate()
        .rev()
        .find(|(_, line)| parse_bind_line(line).map(|b| b.key == key).unwrap_or(false))
        .map(|(i, _)| i);

    match (last_idx, command) {
        (Some(idx), Some(cmd)) => lines[idx] = format!("bind {key} {cmd}"),
        (Some(idx), None) => {
            lines.remove(idx);
        }
        (None, Some(cmd)) => lines.push(format!("bind {key} {cmd}")),
        (None, None) => {}
    }

    if lines.is_empty() {
        String::new()
    } else {
        lines.join(newline) + newline
    }
}

/// Fold a new full bind list into the existing file: keep every non-`bind`
/// line, replace each existing bind whose key appears in `new_binds`, drop
/// existing binds whose key is absent from `new_binds`, and append any brand
/// new binds at the end. This preserves comments/blank lines/directives the
/// editor never modelled instead of nuking them on save.
pub fn merge_binds(existing: &str, new_binds: &[KeyBind]) -> String {
    let newline = detect_newline(existing);
    let mut out: Vec<String> = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();

    for line in existing.lines() {
        if let Some(b) = parse_bind_line(line) {
            if let Some(nb) = new_binds.iter().find(|n| n.key == b.key) {
                out.push(format!("bind {} {}", nb.key, nb.command));
                seen.insert(nb.key.clone());
            }
        } else {
            out.push(line.to_string());
        }
    }

    for nb in new_binds {
        if !seen.contains(&nb.key) {
            out.push(format!("bind {} {}", nb.key, nb.command));
        }
    }

    if out.is_empty() {
        String::new()
    } else {
        out.join(newline) + newline
    }
}

fn detect_newline(content: &str) -> &'static str {
    if content.contains("\r\n") {
        "\r\n"
    } else {
        "\n"
    }
}

fn parse_bind_line(line: &str) -> Option<KeyBind> {
    let rest = line.trim().strip_prefix("bind")?;
    let rest = rest.strip_prefix(char::is_whitespace)?.trim_start();

    let split_pos = rest.find(char::is_whitespace)?;
    let key = rest[..split_pos].to_string();
    if key.is_empty() {
        return None;
    }
    let command = rest[split_pos..].trim_start().to_string();

    Some(KeyBind { key, command })
}

#[tauri::command]
pub fn read_keys_cfg(path: String) -> Result<Vec<KeyBind>, String> {
    load_binds(Path::new(&path))
}

#[tauri::command]
pub fn write_keys_cfg(path: String, binds: Vec<KeyBind>) -> Result<(), String> {
    // Share the global lock so a bind tweak running concurrently with a full
    // editor save cannot interleave and drop either side's binds.
    let _guard = client_cfg::operation_lock()?;
    let p = Path::new(&path);
    let existing = if p.exists() {
        std::fs::read_to_string(p).unwrap_or_default()
    } else {
        String::new()
    };
    let content = merge_binds(&existing, &binds);
    client_cfg::write_atomic(p, &content)
}