use std::collections::BTreeMap;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, MutexGuard, OnceLock};

static TEMP_FILE_COUNTER: AtomicU64 = AtomicU64::new(0);
static OPERATION_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

/// Process-wide mutex serializing every config mutation. Both tweak ops and
/// graphics tiers funnel through this so concurrent invokes cannot interleave
/// read-modify-write cycles and silently drop each other's changes.
pub(crate) fn operation_lock() -> Result<MutexGuard<'static, ()>, String> {
    OPERATION_LOCK
        .get_or_init(|| Mutex::new(()))
        .lock()
        .map_err(|_| "Внутренняя блокировка конфигов повреждена".to_string())
}

pub fn read(path: &Path) -> Result<String, String> {
    match std::fs::read_to_string(path) {
        Ok(content) => Ok(content),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(String::new()),
        Err(error) => Err(error.to_string()),
    }
}

pub fn parse(content: &str) -> BTreeMap<String, String> {
    let mut values = BTreeMap::new();
    for line in content.lines() {
        if let Some((key, value)) = parse_line(line) {
            values.insert(key.to_string(), value.to_string());
        }
    }
    values
}

pub fn apply_values(content: &str, changes: &BTreeMap<String, Option<String>>) -> String {
    let newline = if content.contains("\r\n") {
        "\r\n"
    } else {
        "\n"
    };
    let mut lines: Vec<String> = content.lines().map(str::to_string).collect();

    for (key, value) in changes {
        let matching_lines: Vec<usize> = lines
            .iter()
            .enumerate()
            .filter_map(|(index, line)| {
                parse_line(line)
                    .filter(|(line_key, _)| line_key == key)
                    .map(|_| index)
            })
            .collect();

        if matching_lines.len() > 1 {
            log::warn!(
                "client.cfg has {} entries for {}; only the last is touched, others preserved",
                matching_lines.len(),
                key
            );
        }

        let last_matching_line = matching_lines.last().copied();

        match value {
            Some(value) => {
                let replacement = if let Some(idx) = last_matching_line {
                    let suffix = line_suffix(&lines[idx]);
                    format!("{key} \"{value}\"{suffix}")
                } else {
                    format!("{key} \"{value}\"")
                };
                if let Some(idx) = last_matching_line {
                    lines[idx] = replacement;
                } else {
                    lines.push(replacement);
                }
            }
            None => {
                if let Some(idx) = last_matching_line {
                    lines.remove(idx);
                }
            }
        }
    }

    if lines.is_empty() {
        String::new()
    } else {
        lines.join(newline) + newline
    }
}

pub fn write_atomic(path: &Path, content: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    // A stale temp file from a prior crashed process (pid reuse + matching
    // counter) would block `create_new` forever. Bump the counter and retry a
    // few times before giving up so a transient leftover never wedges writes.
    let mut last_temp: Option<PathBuf> = None;
    let write_result = (|| {
        for _ in 0..16 {
            let temporary_path = temporary_path(path);
            last_temp = Some(temporary_path.clone());
            match OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&temporary_path)
            {
                Ok(mut file) => {
                    let flushed = file
                        .write_all(content.as_bytes())
                        .and_then(|_| file.sync_all());
                    if let Err(error) = flushed {
                        let _ = std::fs::remove_file(&temporary_path);
                        return Err(error.to_string());
                    }
                    return std::fs::rename(&temporary_path, path).map_err(|e| e.to_string());
                }
                Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
                Err(error) => return Err(error.to_string()),
            }
        }
        Err("Не удалось создать временный файл после 16 попыток".to_string())
    })();

    if write_result.is_err() {
        if let Some(temp) = last_temp {
            let _ = std::fs::remove_file(&temp);
        }
    }
    write_result
}

fn parse_line(line: &str) -> Option<(&str, &str)> {
    let trimmed = line.trim();
    if trimmed.is_empty() || trimmed.starts_with("//") || trimmed.starts_with('#') {
        return None;
    }

    let quote_start = trimmed.find('"')?;
    let key = trimmed[..quote_start].trim();
    if key.is_empty() {
        return None;
    }

    let rest = &trimmed[quote_start + 1..];
    let quote_end = rest.find('"')?;
    Some((key, &rest[..quote_end]))
}

/// Everything after the closing value quote on a parsed line, kept verbatim so
/// inline comments (`graphics.fov "90" // competitive`) survive being rewritten.
fn line_suffix(line: &str) -> String {
    let trimmed = line.trim();
    let Some(quote_start) = trimmed.find('"') else { return String::new() };
    let rest = &trimmed[quote_start + 1..];
    let Some(quote_end) = rest.find('"') else { return String::new() };
    rest[quote_end + 1..].to_string()
}

fn temporary_path(path: &Path) -> PathBuf {
    let counter = TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed);
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("client.cfg");
    path.with_file_name(format!(
        ".{file_name}.{}.{}.tmp",
        std::process::id(),
        counter
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeMap;
    use std::fs;

    // ── parse_line ────────────────────────────────────────────────────────────

    #[test]
    fn parse_line_valid() {
        assert_eq!(parse_line(r#"graphics.fov "90""#), Some(("graphics.fov", "90")));
    }

    #[test]
    fn parse_line_trimmed() {
        assert_eq!(
            parse_line(r#"  graphics.fov  "90"  "#),
            Some(("graphics.fov", "90"))
        );
    }

    #[test]
    fn parse_line_single_quotes_not_special() {
        // single quotes are not parsed as quotes
        assert_eq!(parse_line(r#"key 'value'"#), None);
    }

    #[test]
    fn parse_line_comment_slash() {
        assert_eq!(parse_line(r#"// this is a comment"#), None);
    }

    #[test]
    fn parse_line_comment_hash() {
        assert_eq!(parse_line(r#"# comment"#), None);
    }

    #[test]
    fn parse_line_empty() {
        assert_eq!(parse_line(""), None);
    }

    #[test]
    fn parse_line_whitespace_only() {
        assert_eq!(parse_line("   "), None);
    }

    #[test]
    fn parse_line_no_quotes() {
        assert_eq!(parse_line("key value"), None);
    }

    #[test]
    fn parse_line_no_closing_quote() {
        assert_eq!(parse_line(r#"key "value"#), None);
    }

    #[test]
    fn parse_line_no_key() {
        assert_eq!(parse_line(r#""value""#), None);
    }

    #[test]
    fn parse_line_untrimmed_key_is_valid() {
        // key is trimmed even if there are spaces before it
        assert_eq!(parse_line(r#"  key "val""#), Some(("key", "val")));
    }

    // ── line_suffix ──────────────────────────────────────────────────────────

    #[test]
    fn line_suffix_with_comment() {
        assert_eq!(
            line_suffix(r#"graphics.fov "90" // competitive"#),
            " // competitive"
        );
    }

    #[test]
    fn line_suffix_none() {
        assert_eq!(line_suffix(r#"graphics.fov "90""#), "");
    }

    #[test]
    fn line_suffix_trailing_comment() {
        assert_eq!(line_suffix(r#"key "val" // comment"#), " // comment");
    }

    #[test]
    fn line_suffix_no_quotes() {
        assert_eq!(line_suffix("key value"), "");
    }

    #[test]
    fn line_suffix_unclosed_quote() {
        assert_eq!(line_suffix(r#"key "value"#), "");
    }

    // ── parse ────────────────────────────────────────────────────────────────

    #[test]
    fn parse_empty_content() {
        let result = parse("");
        assert!(result.is_empty());
    }

    #[test]
    fn parse_single_line() {
        let result = parse(r#"graphics.fov "90""#);
        let mut expected = BTreeMap::new();
        expected.insert("graphics.fov".to_string(), "90".to_string());
        assert_eq!(result, expected);
    }

    #[test]
    fn parse_multiple_lines() {
        let content = r#"graphics.fov "90"
graphics.quality "2"
// comment
key "value""#;
        let result = parse(content);
        assert_eq!(result.get("graphics.fov").unwrap(), "90");
        assert_eq!(result.get("graphics.quality").unwrap(), "2");
        assert_eq!(result.get("key").unwrap(), "value");
        assert_eq!(result.len(), 3);
    }

    #[test]
    fn parse_comments_ignored() {
        let content = r#"# hash comment
// slash comment
key "val""#;
        let result = parse(content);
        assert_eq!(result.len(), 1);
        assert_eq!(result.get("key").unwrap(), "val");
    }

    #[test]
    fn parse_blank_lines_ignored() {
        let content = "key1 \"v1\"\n\n\nkey2 \"v2\"";
        let result = parse(content);
        assert_eq!(result.len(), 2);
    }

    #[test]
    fn parse_duplicate_key_last_wins() {
        let content = r#"key "first"
key "second""#;
        let result = parse(content);
        assert_eq!(result.get("key").unwrap(), "second");
    }

    // ── read ─────────────────────────────────────────────────────────────────

    #[test]
    fn read_existing_file() {
        let dir = std::env::temp_dir().join(format!("client_cfg_test_{}", std::process::id()));
        let _ = fs::create_dir_all(&dir);
        let path = dir.join("test.cfg");
        fs::write(&path, b"key \"val\"").unwrap();
        assert_eq!(read(&path).unwrap(), "key \"val\"");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn read_missing_file_returns_empty() {
        let temp = std::env::temp_dir()
            .join(format!("nonexistent_{}.cfg", std::process::id()));
        let path = Path::new(&temp);
        assert_eq!(read(path).unwrap(), "");
    }

    #[test]
    fn read_error_on_directory() {
        let dir = std::env::temp_dir().join(format!("is_a_dir_{}", std::process::id()));
        let _ = fs::create_dir_all(&dir);
        assert!(read(&dir).is_err());
        let _ = fs::remove_dir_all(&dir);
    }

    // ── apply_values ─────────────────────────────────────────────────────────

    #[test]
    fn apply_values_update_existing() {
        let content = r#"graphics.fov "90""#;
        let mut changes = BTreeMap::new();
        changes.insert("graphics.fov".to_string(), Some("70".to_string()));
        let result = apply_values(content, &changes);
        assert_eq!(result, "graphics.fov \"70\"\n");
    }

    #[test]
    fn apply_values_insert_new() {
        let content = r#"graphics.fov "90""#;
        let mut changes = BTreeMap::new();
        changes.insert("new.key".to_string(), Some("val".to_string()));
        let result = apply_values(content, &changes);
        assert_eq!(result, "graphics.fov \"90\"\nnew.key \"val\"\n");
    }

    #[test]
    fn apply_values_remove_existing() {
        let content = r#"graphics.fov "90"
key "val""#;
        let mut changes = BTreeMap::new();
        changes.insert("key".to_string(), None);
        let result = apply_values(content, &changes);
        assert_eq!(result, "graphics.fov \"90\"\n");
    }

    #[test]
    fn apply_values_remove_nonexistent() {
        let content = r#"graphics.fov "90""#;
        let mut changes = BTreeMap::new();
        changes.insert("nonexistent".to_string(), None);
        let result = apply_values(content, &changes);
        assert_eq!(result, "graphics.fov \"90\"\n");
    }

    #[test]
    fn apply_values_empty_content() {
        let mut changes = BTreeMap::new();
        changes.insert("key".to_string(), Some("val".to_string()));
        let result = apply_values("", &changes);
        assert_eq!(result, "key \"val\"\n");
    }

    #[test]
    fn apply_values_remove_last_line_returns_empty() {
        let content = r#"key "val""#;
        let mut changes = BTreeMap::new();
        changes.insert("key".to_string(), None);
        let result = apply_values(content, &changes);
        assert_eq!(result, "");
    }

    #[test]
    fn apply_values_windows_newline() {
        let content = "key \"val\"\r\nfoo \"bar\"";
        let mut changes = BTreeMap::new();
        changes.insert("key".to_string(), Some("new".to_string()));
        let result = apply_values(content, &changes);
        assert_eq!(result, "key \"new\"\r\nfoo \"bar\"\r\n");
    }

    #[test]
    fn apply_values_preserves_inline_comment() {
        let content = r#"graphics.fov "90" // competitive"#;
        let mut changes = BTreeMap::new();
        changes.insert("graphics.fov".to_string(), Some("70".to_string()));
        let result = apply_values(content, &changes);
        assert_eq!(result, "graphics.fov \"70\" // competitive\n");
    }

    #[test]
    fn apply_values_multiple_matches_updates_last() {
        let content = "key \"1\"\nkey \"2\"";
        let mut changes = BTreeMap::new();
        changes.insert("key".to_string(), Some("3".to_string()));
        let result = apply_values(content, &changes);
        assert_eq!(result, "key \"1\"\nkey \"3\"\n");
    }

    #[test]
    fn apply_values_new_lines_have_no_suffix() {
        let content = r#"existing "val""#;
        let mut changes = BTreeMap::new();
        changes.insert("new".to_string(), Some("val".to_string()));
        let result = apply_values(content, &changes);
        // new lines shouldn't have trailing comment
        assert!(result.contains("new \"val\"\n"));
    }

    #[test]
    fn apply_values_duplicate_key_triggers_warning() {
        // duplicate key in content — should update the last occurrence
        let content = "key \"first\"\nkey \"second\"";
        let mut changes = BTreeMap::new();
        changes.insert("key".to_string(), Some("third".to_string()));
        let result = apply_values(content, &changes);
        assert_eq!(result, "key \"first\"\nkey \"third\"\n");
    }



    // ── temporary_path ───────────────────────────────────────────────────────

    #[test]
    fn temporary_path_uses_pid_and_counter() {
        let path = Path::new(r"C:\cfg\client.cfg");
        let result = temporary_path(path);
        let result_str = result.to_string_lossy();
        assert!(result_str.contains(".client.cfg."));
        assert!(result_str.contains(std::process::id().to_string().as_str()));
        assert!(result_str.ends_with(".tmp"));
    }

    #[test]
    fn temporary_path_no_file_name() {
        let path = Path::new(r"C:\");
        let result = temporary_path(path);
        assert!(result.to_string_lossy().contains(".client.cfg."));
    }

    // ── write_atomic ─────────────────────────────────────────────────────────

    #[test]
    fn write_atomic_creates_file() {
        let dir = std::env::temp_dir().join(format!("atomic_test_{}", std::process::id()));
        let _ = fs::create_dir_all(&dir);
        let path = dir.join("test.cfg");
        write_atomic(&path, "hello world").unwrap();
        let content = fs::read_to_string(&path).unwrap();
        assert_eq!(content, "hello world");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn write_atomic_overwrites() {
        let dir = std::env::temp_dir().join(format!("atomic_test_over_{}", std::process::id()));
        let _ = fs::create_dir_all(&dir);
        let path = dir.join("test.cfg");
        write_atomic(&path, "first").unwrap();
        write_atomic(&path, "second").unwrap();
        let content = fs::read_to_string(&path).unwrap();
        assert_eq!(content, "second");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn write_atomic_creates_parent_dirs() {
        let dir = std::env::temp_dir().join(format!("atomic_parent_{}", std::process::id()));
        let path = dir.join("sub").join("nested").join("test.cfg");
        write_atomic(&path, "content").unwrap();
        assert!(path.exists());
        let content = fs::read_to_string(&path).unwrap();
        assert_eq!(content, "content");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn write_atomic_error_on_directory_path() {
        let dir = std::env::temp_dir().join(format!("atomic_dir_{}", std::process::id()));
        let _ = fs::create_dir_all(&dir);
        assert!(write_atomic(&dir, "content").is_err());
        let _ = fs::remove_dir_all(&dir);
    }

    // ── operation_lock ───────────────────────────────────────────────────────

    #[test]
    fn operation_lock_acquires() {
        let guard = operation_lock();
        assert!(guard.is_ok());
    }


}
