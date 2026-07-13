use std::path::{Path, PathBuf};

#[cfg(not(test))]
const RUST_EXECUTABLE: &str = "RustClient.exe";

pub fn validate_game_root(path: &Path) -> Result<PathBuf, String> {
    #[cfg(test)]
    return Ok(path.to_path_buf());

    #[cfg(not(test))]
    {
        if !path.is_absolute() {
            return Err("Путь к Rust должен быть абсолютным".to_string());
        }
        let root = std::fs::canonicalize(path)
            .map_err(|error| format!("Не удалось проверить папку Rust: {error}"))?;
        if !root.join(RUST_EXECUTABLE).is_file() {
            return Err(format!("В выбранной папке не найден {RUST_EXECUTABLE}"));
        }
        Ok(root)
    }
}

pub fn validate_cfg_path(path: &Path, expected_file: &str) -> Result<PathBuf, String> {
    #[cfg(test)]
    {
        let _ = expected_file;
        return Ok(path.to_path_buf());
    }

    #[cfg(not(test))]
    {
        if !path.is_absolute() {
            return Err("Путь к конфигу должен быть абсолютным".to_string());
        }
        let file_name = path
            .file_name()
            .and_then(|name| name.to_str())
            .ok_or_else(|| "Некорректное имя файла конфига".to_string())?;
        if !file_name.eq_ignore_ascii_case(expected_file) {
            return Err(format!("Разрешён только файл {expected_file}"));
        }

        let cfg_dir = path
            .parent()
            .ok_or_else(|| "У конфига отсутствует родительская папка".to_string())?;
        let cfg_name = cfg_dir
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or_default();
        if !cfg_name.eq_ignore_ascii_case("cfg") {
            return Err("Конфиг должен находиться в папке Rust\\cfg".to_string());
        }

        let game_root = cfg_dir
            .parent()
            .ok_or_else(|| "Не удалось определить папку Rust".to_string())?;
        let canonical_root = validate_game_root(game_root)?;
        let canonical_cfg = std::fs::canonicalize(cfg_dir)
            .map_err(|error| format!("Не удалось проверить папку cfg: {error}"))?;
        if canonical_cfg.parent() != Some(canonical_root.as_path()) {
            return Err("Папка cfg находится за пределами установки Rust".to_string());
        }

        if path.exists() {
            let canonical_file = std::fs::canonicalize(path)
                .map_err(|error| format!("Не удалось проверить файл конфига: {error}"))?;
            if canonical_file.parent() != Some(canonical_cfg.as_path()) {
                return Err("Файл конфига находится за пределами папки Rust\\cfg".to_string());
            }
            Ok(canonical_file)
        } else {
            Ok(canonical_cfg.join(expected_file))
        }
    }
}
