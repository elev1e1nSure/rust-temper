use std::path::PathBuf;

const RUST_CFG_RELATIVE: &str = "steamapps/common/Rust/cfg/keys.cfg";

#[cfg(target_os = "windows")]
mod rust_locator_windows;

#[tauri::command]
pub fn find_keys_cfg() -> Option<String> {
    for library in steam_library_folders() {
        let candidate = library.join(RUST_CFG_RELATIVE);
        if candidate.is_file() {
            return Some(normalize(&candidate));
        }
    }

    for candidate in drive_fallback_candidates() {
        if candidate.is_file() {
            return Some(normalize(&candidate));
        }
    }

    None
}

fn normalize(path: &std::path::Path) -> String {
    path.to_string_lossy().replace('/', "\\")
}

fn steam_library_folders() -> Vec<PathBuf> {
    let mut folders = Vec::new();

    for steam_path in steam_install_paths() {
        let vdf_path = steam_path.join("steamapps").join("libraryfolders.vdf");
        match std::fs::read_to_string(&vdf_path) {
            Ok(content) => folders.extend(parse_library_paths(&content)),
            Err(e) => log::warn!(
                "Не удалось прочитать libraryfolders.vdf по пути {}: {e}",
                vdf_path.display()
            ),
        }
        folders.push(steam_path);
    }

    folders
}

fn parse_library_paths(vdf: &str) -> Vec<PathBuf> {
    vdf.lines()
        .filter(|line| line.trim_start().starts_with("\"path\""))
        .filter_map(|line| line.split('"').nth(3))
        .map(|raw| PathBuf::from(raw.replace("\\\\", "\\")))
        .collect()
}

#[cfg(target_os = "windows")]
fn steam_install_paths() -> Vec<PathBuf> {
    rust_locator_windows::steam_install_paths()
}

#[cfg(not(target_os = "windows"))]
fn steam_install_paths() -> Vec<PathBuf> {
    Vec::new()
}

#[cfg(target_os = "windows")]
fn drive_fallback_candidates() -> Vec<PathBuf> {
    rust_locator_windows::drive_fallback_candidates()
}

#[cfg(not(target_os = "windows"))]
fn drive_fallback_candidates() -> Vec<PathBuf> {
    Vec::new()
}
