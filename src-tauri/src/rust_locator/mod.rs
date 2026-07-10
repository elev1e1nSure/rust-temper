use std::path::PathBuf;

use crate::vdf;

const RUST_INSTALL_RELATIVE: &str = "steamapps/common/Rust";
/// Sentinel file used to confirm a candidate directory is actually a Rust install.
const RUST_CFG_MARKER: &str = "cfg/keys.cfg";

#[cfg(target_os = "windows")]
mod rust_locator_windows;

#[tauri::command]
pub fn find_rust_install() -> Option<String> {
    for library in steam_library_folders() {
        let candidate = library.join(RUST_INSTALL_RELATIVE);
        if candidate.join(RUST_CFG_MARKER).is_file() {
            return Some(normalize(&candidate));
        }
    }

    for candidate in drive_fallback_candidates() {
        if candidate.join(RUST_CFG_MARKER).is_file() {
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

fn parse_library_paths(vdf_content: &str) -> Vec<PathBuf> {
    let tree = match vdf::parse(vdf_content) {
        Ok(tree) => tree,
        Err(error) => {
            log::warn!("Не удалось разобрать libraryfolders.vdf: {error}");
            return Vec::new();
        }
    };
    let Some(libraries) = vdf::get_obj(&tree, "libraryfolders") else {
        return Vec::new();
    };
    libraries
        .iter()
        .filter_map(|(_, node)| match node {
            vdf::Node::Obj(members) => vdf::get_str(members, "path").map(|s| s.to_string()),
            _ => None,
        })
        .map(|raw| PathBuf::from(raw.replace("\\\\", "\\")))
        .collect()
}

#[cfg(target_os = "windows")]
pub(crate) fn steam_install_paths() -> Vec<PathBuf> {
    rust_locator_windows::steam_install_paths()
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn steam_install_paths() -> Vec<PathBuf> {
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
