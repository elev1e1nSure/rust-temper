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
