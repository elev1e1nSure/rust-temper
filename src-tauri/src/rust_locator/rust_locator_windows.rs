use std::path::PathBuf;

const RUST_CFG_RELATIVE: &str = "steamapps/common/Rust/cfg/keys.cfg";

const FALLBACK_STEAM_DIRS: &[&str] = &[
    "SteamLibrary",
    "Steam",
    "Program Files (x86)\\Steam",
    "Program Files\\Steam",
    "Games\\Steam",
    "Games\\SteamLibrary",
];

pub fn steam_install_paths() -> Vec<PathBuf> {
    use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE};
    use winreg::RegKey;

    let mut paths = Vec::new();

    if let Ok(key) = RegKey::predef(HKEY_CURRENT_USER).open_subkey("Software\\Valve\\Steam") {
        match key.get_value::<String, _>("SteamPath") {
            Ok(path) => paths.push(PathBuf::from(path.replace('/', "\\"))),
            Err(e) => log::warn!("Не удалось прочитать SteamPath из HKCU: {e}"),
        }
    }

    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    for (subkey, value_name) in [
        ("SOFTWARE\\WOW6432Node\\Valve\\Steam", "InstallPath"),
        ("SOFTWARE\\Valve\\Steam", "InstallPath"),
    ] {
        match hklm.open_subkey(subkey) {
            Ok(key) => match key.get_value::<String, _>(value_name) {
                Ok(path) => paths.push(PathBuf::from(path)),
                Err(e) => log::warn!("Не удалось прочитать {value_name} из {subkey}: {e}"),
            },
            Err(e) => log::warn!("Не удалось открыть раздел реестра {subkey}: {e}"),
        }
    }

    paths
}

pub fn drive_fallback_candidates() -> Vec<PathBuf> {
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
