use std::path::PathBuf;

const RUST_CFG_RELATIVE: &str = "steamapps/common/Rust/cfg/keys.cfg";

/// Steam library folder names people commonly use when they install Steam
/// itself (or an extra library) outside the default Program Files location.
const FALLBACK_STEAM_DIRS: &[&str] = &[
    "SteamLibrary",
    "Steam",
    "Program Files (x86)\\Steam",
    "Program Files\\Steam",
    "Games\\Steam",
    "Games\\SteamLibrary",
];

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
        if let Ok(content) = std::fs::read_to_string(&vdf_path) {
            folders.extend(parse_library_paths(&content));
        }
        folders.push(steam_path);
    }

    folders
}

/// `libraryfolders.vdf` is Valve's own key-value format, not JSON — pull the
/// `"path"` entries out with a plain line scan instead of pulling in a vdf crate.
fn parse_library_paths(vdf: &str) -> Vec<PathBuf> {
    vdf.lines()
        .filter(|line| line.trim_start().starts_with("\"path\""))
        .filter_map(|line| line.split('"').nth(3))
        .map(|raw| PathBuf::from(raw.replace("\\\\", "\\")))
        .collect()
}

#[cfg(target_os = "windows")]
fn steam_install_paths() -> Vec<PathBuf> {
    use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE};
    use winreg::RegKey;

    let mut paths = Vec::new();

    if let Ok(key) = RegKey::predef(HKEY_CURRENT_USER).open_subkey("Software\\Valve\\Steam") {
        if let Ok(path) = key.get_value::<String, _>("SteamPath") {
            paths.push(PathBuf::from(path.replace('/', "\\")));
        }
    }

    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    for (subkey, value_name) in [
        ("SOFTWARE\\WOW6432Node\\Valve\\Steam", "InstallPath"),
        ("SOFTWARE\\Valve\\Steam", "InstallPath"),
    ] {
        if let Ok(key) = hklm.open_subkey(subkey) {
            if let Ok(path) = key.get_value::<String, _>(value_name) {
                paths.push(PathBuf::from(path));
            }
        }
    }

    paths
}

#[cfg(not(target_os = "windows"))]
fn steam_install_paths() -> Vec<PathBuf> {
    Vec::new()
}

/// Registry lookup covers the vast majority of installs. As a last resort,
/// probe common Steam folder names on every present drive letter — a fixed
/// set of `is_file()` checks (<=26 drives * a handful of names), not a
/// recursive disk walk, so it stays fast.
#[cfg(target_os = "windows")]
fn drive_fallback_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();

    for letter in b'A'..=b'Z' {
        let drive_root = PathBuf::from(format!("{}:\\", letter as char));
        if !drive_root.is_dir() {
            continue;
        }

        for dir_name in FALLBACK_STEAM_DIRS {
            candidates.push(drive_root.join(dir_name).join(RUST_CFG_RELATIVE));
        }
    }

    candidates
}

#[cfg(not(target_os = "windows"))]
fn drive_fallback_candidates() -> Vec<PathBuf> {
    Vec::new()
}
