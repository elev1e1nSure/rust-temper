use std::collections::BTreeMap;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

static TEMP_FILE_COUNTER: AtomicU64 = AtomicU64::new(0);

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
                "client.cfg contains {} entries for {}; canonicalizing targeted key",
                matching_lines.len(),
                key
            );
        }

        let last_matching_line = matching_lines.last().copied();
        let mut index = 0;
        lines.retain(|line| {
            let is_match = parse_line(line)
                .map(|(line_key, _)| line_key == key)
                .unwrap_or(false);
            let keep = !is_match || Some(index) == last_matching_line;
            index += 1;
            keep
        });

        match value {
            Some(value) => {
                let replacement = format!("{key} \"{value}\"");
                if let Some(last_matching_line) = last_matching_line {
                    let removed_before = matching_lines
                        .iter()
                        .filter(|position| **position < last_matching_line)
                        .count();
                    lines[last_matching_line - removed_before] = replacement;
                } else {
                    lines.push(replacement);
                }
            }
            None => {
                if last_matching_line.is_some() {
                    lines.retain(|line| {
                        parse_line(line)
                            .map(|(line_key, _)| line_key != key)
                            .unwrap_or(true)
                    });
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

pub fn write_atomic(path: &Path, content: &str, create_backup: bool) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let temporary_path = temporary_path(path);
    let write_result = (|| {
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary_path)
            .map_err(|error| error.to_string())?;
        file.write_all(content.as_bytes())
            .and_then(|_| file.sync_all())
            .map_err(|error| error.to_string())?;

        if create_backup && path.exists() {
            std::fs::copy(path, backup_path(path)).map_err(|error| error.to_string())?;
        }

        std::fs::rename(&temporary_path, path).map_err(|error| error.to_string())
    })();

    if write_result.is_err() {
        let _ = std::fs::remove_file(&temporary_path);
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

fn backup_path(path: &Path) -> PathBuf {
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("client.cfg");
    path.with_file_name(format!("{file_name}.bak"))
}
