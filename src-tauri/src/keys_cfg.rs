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

#[cfg(test)]
mod tests {
    use super::*;

    // ── parse_bind_line ───────────────────────────────────────────────────────

    #[test]
    fn parse_bind_line_simple() {
        let result = parse_bind_line("bind p jump").unwrap();
        assert_eq!(result.key, "p");
        assert_eq!(result.command, "jump");
    }

    #[test]
    fn parse_bind_line_complex_command() {
        let result = parse_bind_line("bind f +attack;+forward").unwrap();
        assert_eq!(result.key, "f");
        assert_eq!(result.command, "+attack;+forward");
    }

    #[test]
    fn parse_bind_line_leading_whitespace() {
        let result = parse_bind_line("  bind q kill").unwrap();
        assert_eq!(result.key, "q");
        assert_eq!(result.command, "kill");
    }

    #[test]
    fn parse_bind_line_trailing_whitespace() {
        let result = parse_bind_line("bind r reload  ").unwrap();
        assert_eq!(result.key, "r");
        assert_eq!(result.command, "reload");
    }

    #[test]
    fn parse_bind_line_no_prefix() {
        assert!(parse_bind_line("p jump").is_none());
    }

    #[test]
    fn parse_bind_line_empty_key() {
        assert!(parse_bind_line("bind  jump").is_none());
    }

    #[test]
    fn parse_bind_line_only_bind() {
        assert!(parse_bind_line("bind").is_none());
    }

    #[test]
    fn parse_bind_line_bind_with_no_command() {
        // bind with key but no command is not parseable (no whitespace after key)
        assert!(parse_bind_line("bind p").is_none());
    }

    #[test]
    fn parse_bind_line_comment_line() {
        assert!(parse_bind_line("// bind p jump").is_none());
    }

    #[test]
    fn parse_bind_line_not_a_bind_line() {
        assert!(parse_bind_line("something else").is_none());
    }

    // ── detect_newline ────────────────────────────────────────────────────────

    #[test]
    fn detect_newline_unix() {
        assert_eq!(detect_newline("a\nb"), "\n");
    }

    #[test]
    fn detect_newline_windows() {
        assert_eq!(detect_newline("a\r\nb"), "\r\n");
    }

    #[test]
    fn detect_newline_empty() {
        assert_eq!(detect_newline(""), "\n");
    }

    #[test]
    fn detect_newline_no_newlines() {
        assert_eq!(detect_newline("abc"), "\n");
    }

    // ── apply_bind ────────────────────────────────────────────────────────────

    #[test]
    fn apply_bind_set_new() {
        let content = "// some comment\n";
        let result = apply_bind(content, "p", Some("jump"));
        assert_eq!(result, "// some comment\nbind p jump\n");
    }

    #[test]
    fn apply_bind_replace_existing() {
        let content = "bind p oldcmd\n";
        let result = apply_bind(content, "p", Some("newcmd"));
        assert_eq!(result, "bind p newcmd\n");
    }

    #[test]
    fn apply_bind_remove_existing() {
        let content = "bind p jump\nbind f attack\n";
        let result = apply_bind(content, "p", None);
        assert_eq!(result, "bind f attack\n");
    }

    #[test]
    fn apply_bind_remove_nonexistent() {
        let content = "bind f attack\n";
        let result = apply_bind(content, "p", None);
        assert_eq!(result, "bind f attack\n");
    }

    #[test]
    fn apply_bind_empty_content() {
        let result = apply_bind("", "p", Some("jump"));
        assert_eq!(result, "bind p jump\n");
    }

    #[test]
    fn apply_bind_remove_last_returns_empty() {
        let content = "bind p jump\n";
        let result = apply_bind(content, "p", None);
        assert_eq!(result, "");
    }

    #[test]
    fn apply_bind_empty_content_remove() {
        let result = apply_bind("", "p", None);
        assert_eq!(result, "");
    }

    #[test]
    fn apply_bind_preserves_comments() {
        let content = "// comment\nbind p jump\n# another comment\n";
        let result = apply_bind(content, "p", Some("kill"));
        assert_eq!(result, "// comment\nbind p kill\n# another comment\n");
    }

    #[test]
    fn apply_bind_updates_last_occurrence() {
        let content = "bind p first\nbind p second\n";
        let result = apply_bind(content, "p", Some("third"));
        assert_eq!(result, "bind p first\nbind p third\n");
    }

    #[test]
    fn apply_bind_removes_last_occurrence() {
        let content = "bind p first\nbind p second\n";
        let result = apply_bind(content, "p", None);
        assert_eq!(result, "bind p first\n");
    }

    #[test]
    fn apply_bind_windows_newline() {
        let content = "bind p jump\r\n";
        let result = apply_bind(content, "p", Some("kill"));
        assert_eq!(result, "bind p kill\r\n");
    }

    // ── merge_binds ──────────────────────────────────────────────────────────

    #[test]
    fn merge_binds_replaces_existing() {
        let existing = "// comment\nbind p jump\nbind f attack\n";
        let new_binds = vec![KeyBind {
            key: "p".into(),
            command: "kill".into(),
        }];
        let result = merge_binds(existing, &new_binds);
        // f not in new list → dropped
        assert_eq!(result, "// comment\nbind p kill\n");
    }

    #[test]
    fn merge_binds_drops_removed() {
        let existing = "bind p jump\nbind f attack\n";
        let new_binds = vec![KeyBind {
            key: "p".into(),
            command: "jump".into(),
        }];
        let result = merge_binds(existing, &new_binds);
        // f bind should be dropped
        assert!(result.contains("bind p jump"));
        assert!(!result.contains("bind f"));
    }

    #[test]
    fn merge_binds_appends_new() {
        let existing = "bind p jump\n";
        let new_binds = vec![
            KeyBind {
                key: "p".into(),
                command: "jump".into(),
            },
            KeyBind {
                key: "f".into(),
                command: "attack".into(),
            },
        ];
        let result = merge_binds(existing, &new_binds);
        assert!(result.contains("bind p jump"));
        assert!(result.contains("bind f attack"));
    }

    #[test]
    fn merge_binds_preserves_non_bind_lines() {
        let existing = "// header comment\nbind p jump\n# footer comment\n";
        let new_binds = vec![KeyBind {
            key: "p".into(),
            command: "kill".into(),
        }];
        let result = merge_binds(existing, &new_binds);
        assert!(result.contains("// header comment"));
        assert!(result.contains("# footer comment"));
        assert!(result.contains("bind p kill"));
    }

    #[test]
    fn merge_binds_empty_existing() {
        let existing = "";
        let new_binds = vec![KeyBind {
            key: "p".into(),
            command: "jump".into(),
        }];
        let result = merge_binds(existing, &new_binds);
        assert_eq!(result, "bind p jump\n");
    }

    #[test]
    fn merge_binds_empty_new_binds() {
        let existing = "bind p jump\n";
        let new_binds: Vec<KeyBind> = vec![];
        let result = merge_binds(existing, &new_binds);
        assert_eq!(result, "");
    }

    #[test]
    fn merge_binds_empty_both() {
        let result = merge_binds("", &[]);
        assert_eq!(result, "");
    }

    // ── load_binds ───────────────────────────────────────────────────────────

    #[test]
    fn load_binds_from_existing_file() {
        let dir = std::env::temp_dir().join(format!("keys_load_{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("keys.cfg");
        std::fs::write(&path, b"bind p jump\nbind f attack\n// comment\n").unwrap();
        let binds = load_binds(&path).unwrap();
        assert_eq!(binds.len(), 2);
        assert_eq!(binds[0].key, "p");
        assert_eq!(binds[1].command, "attack");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn load_binds_filters_non_bind_lines() {
        let dir = std::env::temp_dir().join(format!("keys_load_f_{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("keys.cfg");
        std::fs::write(
            &path,
            b"// comment\nalias test cmd\nbind p jump\n# another\n",
        )
        .unwrap();
        let binds = load_binds(&path).unwrap();
        assert_eq!(binds.len(), 1);
        assert_eq!(binds[0].key, "p");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn load_binds_missing_file_error() {
        let dir = std::env::temp_dir().join(format!("keys_load_m_{}", std::process::id()));
        let path = dir.join("nonexistent.cfg");
        let result = load_binds(&path);
        assert!(result.is_err());
    }

    // ── write_keys_cfg ────────────────────────────────────────────────────────

    #[test]
    fn write_keys_cfg_creates_file() {
        let dir = std::env::temp_dir().join(format!("keys_write_{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("keys.cfg").to_string_lossy().to_string();
        let binds = vec![KeyBind {
            key: "p".into(),
            command: "jump".into(),
        }];
        write_keys_cfg(path.clone(), binds.clone()).unwrap();
        let loaded = load_binds(Path::new(&path)).unwrap();
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].key, "p");
        assert_eq!(loaded[0].command, "jump");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn write_keys_cfg_merges_with_existing() {
        let dir = std::env::temp_dir().join(format!("keys_write_m_{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("keys.cfg");
        std::fs::write(&path, b"bind f attack\n// keep me\n").unwrap();
        let binds = vec![
            KeyBind {
                key: "p".into(),
                command: "jump".into(),
            },
            KeyBind {
                key: "f".into(),
                command: "attack".into(),
            },
        ];
        write_keys_cfg(path.to_string_lossy().to_string(), binds).unwrap();
        let content = std::fs::read_to_string(&path).unwrap();
        assert!(content.contains("bind p jump"));
        assert!(content.contains("bind f attack"));
        assert!(content.contains("// keep me"));
        let _ = std::fs::remove_dir_all(&dir);
    }
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
