//! Reads and writes Steam per-game launch options, stored in each account's
//! `userdata/<id>/config/localconfig.vdf` under
//! `Software > Valve > Steam > apps > <appid> > LaunchOptions`.
//!
//! Two things make this non-trivial and drive the design:
//!  1. Steam rewrites `localconfig.vdf` from memory on shutdown, so any edit
//!     made while Steam is running is silently discarded. Every mutation here
//!     first stops Steam via `steam::unload_before_config_write` (the same guard
//!     graphics/tweaks use before touching client.cfg).
//!  2. The target appid string appears many times across unrelated sections of
//!     the file. Naive text search would hit the wrong one, so we parse the VDF
//!     into a tree and navigate the exact key path instead.

use std::path::PathBuf;

use crate::client_cfg;
use crate::steam;
use crate::vdf::{self, Member};

/// Rust's Steam application id.
const RUST_APP_ID: &str = "252490";
/// Key path from the file root down to the `apps` object. Everything lives
/// under the single top-level `UserLocalConfigStore` object.
const APPS_KEY_PATH: &[&str] = &["UserLocalConfigStore", "Software", "Valve", "Steam", "apps"];
const LAUNCH_OPTIONS_KEY: &str = "LaunchOptions";
const LAST_PLAYED_KEY: &str = "LastPlayed";

// ── Public commands ──────────────────────────────────────────────────────────

/// Current launch options for Rust, or `None` if the key is absent.
#[tauri::command]
pub fn read_rust_launch_options() -> Result<Option<String>, String> {
    let path = locate_localconfig()?;
    let tree = vdf::parse(&client_cfg::read(&path)?)?;
    Ok(app_object(&tree, RUST_APP_ID)
        .and_then(|app| vdf::get_str(app, LAUNCH_OPTIONS_KEY))
        .map(str::to_string))
}

/// Create or overwrite Rust's launch options with `options`.
#[tauri::command]
pub fn set_rust_launch_options(options: String) -> Result<(), String> {
    mutate(|app| {
        vdf::set_str(app, LAUNCH_OPTIONS_KEY, &options);
    })
}

/// Remove Rust's launch options entirely (reverts to empty).
#[tauri::command]
pub fn clear_rust_launch_options() -> Result<(), String> {
    mutate(|app| {
        vdf::remove_key(app, LAUNCH_OPTIONS_KEY);
    })
}

/// Add or replace Rust's garbage-collection buffer while preserving all other
/// user-provided launch options.
pub fn set_rust_gc_buffer(buffer_mb: u32) -> Result<(), String> {
    mutate(|app| {
        let current = vdf::get_str(app, LAUNCH_OPTIONS_KEY).unwrap_or_default();
        vdf::set_str(app, LAUNCH_OPTIONS_KEY, &with_gc_buffer(current, buffer_mb));
    })
}

/// Read the configured GC buffer without changing Steam's launch options.
pub fn read_rust_gc_buffer() -> Result<Option<u32>, String> {
    Ok(read_rust_launch_options()?
        .as_deref()
        .and_then(gc_buffer_from_options))
}

/// Remove the `-gc.buffer` flag while preserving all other user-provided
/// launch options.
pub fn clear_rust_gc_buffer() -> Result<(), String> {
    mutate(|app| {
        let current = vdf::get_str(app, LAUNCH_OPTIONS_KEY).unwrap_or_default();
        let stripped = without_gc_buffer(current);
        if stripped.is_empty() {
            vdf::remove_key(app, LAUNCH_OPTIONS_KEY);
        } else {
            vdf::set_str(app, LAUNCH_OPTIONS_KEY, &stripped);
        }
    })
}

fn gc_buffer_from_options(options: &str) -> Option<u32> {
    let tokens: Vec<&str> = options.split_whitespace().collect();
    tokens
        .windows(2)
        .find(|pair| pair[0].eq_ignore_ascii_case("-gc.buffer"))
        .and_then(|pair| pair[1].parse::<u32>().ok())
}

fn without_gc_buffer(options: &str) -> String {
    let tokens: Vec<&str> = options.split_whitespace().collect();
    let mut retained = Vec::with_capacity(tokens.len());
    let mut index = 0;

    while index < tokens.len() {
        if tokens[index].eq_ignore_ascii_case("-gc.buffer") {
            index += 1;
            if index < tokens.len() && tokens[index].parse::<u32>().is_ok() {
                index += 1;
            }
            continue;
        }
        retained.push(tokens[index].to_string());
        index += 1;
    }

    retained.join(" ")
}

fn with_gc_buffer(options: &str, buffer_mb: u32) -> String {
    let mut retained = without_gc_buffer(options);
    if !retained.is_empty() {
        retained.push(' ');
    }
    retained.push_str("-gc.buffer ");
    retained.push_str(&buffer_mb.to_string());
    retained
}

/// Shared read-modify-write skeleton: stop Steam, load the file, mutate the Rust
/// app object (creating the key path if the account has never launched Rust),
/// then write atomically. Serialized against tweak/graphics writes via the same
/// process-wide lock so concurrent invokes can't clobber each other.
fn mutate(edit: impl FnOnce(&mut Vec<Member>)) -> Result<(), String> {
    let _guard = client_cfg::operation_lock()?;
    steam::unload_before_config_write()?;

    let path = locate_localconfig()?;
    let mut tree = vdf::parse(&client_cfg::read(&path)?)?;
    let apps = ensure_path(&mut tree, APPS_KEY_PATH);
    let app = vdf::ensure_object(apps, RUST_APP_ID);
    edit(app);

    client_cfg::write_atomic(&path, &vdf::serialize(&tree))?;
    log::info!(
        "launch options updated appid={RUST_APP_ID} path={}",
        path.display()
    );
    Ok(())
}

// ── Account / file discovery ─────────────────────────────────────────────────

/// Pick the `localconfig.vdf` of the account most likely to be the one playing
/// Rust: highest `LastPlayed` for the Rust app, falling back to the most
/// recently modified file when no account has a Rust entry yet.
fn locate_localconfig() -> Result<PathBuf, String> {
    let candidates = localconfig_candidates();
    if candidates.is_empty() {
        return Err("Не найден файл localconfig.vdf Steam. Проверь, что Steam установлен и ты заходил в аккаунт".to_string());
    }

    let best = candidates
        .into_iter()
        .map(|path| {
            let last_played = std::fs::read_to_string(&path)
                .ok()
                .and_then(|content| vdf::parse(&content).ok())
                .and_then(|tree| {
                    app_object(&tree, RUST_APP_ID)
                        .and_then(|app| vdf::get_str(app, LAST_PLAYED_KEY))
                        .and_then(|value| value.parse::<u64>().ok())
                })
                .unwrap_or(0);
            let mtime = std::fs::metadata(&path)
                .and_then(|meta| meta.modified())
                .ok();
            (path, last_played, mtime)
        })
        .max_by(|a, b| a.1.cmp(&b.1).then(a.2.cmp(&b.2)))
        .map(|(path, ..)| path)
        .expect("candidate list is non-empty");

    log::info!("selected localconfig path={}", best.display());
    Ok(best)
}

fn localconfig_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    for steam_root in crate::rust_locator::steam_install_paths() {
        let userdata = steam_root.join("userdata");
        let Ok(entries) = std::fs::read_dir(&userdata) else {
            continue;
        };
        for account in entries.flatten() {
            // The `anonymous` (0) folder is a Steam bookkeeping account with no
            // real user config; only numeric account ids carry launch options.
            if !account
                .file_name()
                .to_string_lossy()
                .chars()
                .all(|c| c.is_ascii_digit())
            {
                continue;
            }
            let file = account.path().join("config").join("localconfig.vdf");
            if file.is_file() {
                candidates.push(file);
            }
        }
    }
    candidates
}

// ── VDF tree ─────────────────────────────────────────────────────────────────

/// Navigate `root > apps > <appid>` and return that app's members, if present.
fn app_object<'a>(root: &'a [Member], appid: &str) -> Option<&'a [Member]> {
    let mut node = root;
    for key in APPS_KEY_PATH {
        node = vdf::get_obj(node, key)?;
    }
    vdf::get_obj(node, appid)
}

/// Walk (creating missing objects) a chain of object keys, returning the deepest
/// object's members for mutation.
fn ensure_path<'a>(mut members: &'a mut Vec<Member>, keys: &[&str]) -> &'a mut Vec<Member> {
    for key in keys {
        members = vdf::ensure_object(members, key);
    }
    members
}

// ── GC buffer helpers ─────────────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = r#"
"UserLocalConfigStore"
{
	"Software"
	{
		"Valve"
		{
			"Steam"
			{
				"apps"
				{
					"252490"
					{
						"LastPlayed"		"1783604587"
						"LaunchOptions"		"-graphics.shadowmode \"1\" -tree.quality \"500\""
					}
					"730"
					{
						"LastPlayed"		"1783543312"
					}
				}
			}
		}
	}
}
"#;

    fn rust_app(tree: &[Member]) -> &[Member] {
        app_object(tree, RUST_APP_ID).expect("rust app present")
    }

    #[test]
    fn parses_and_reads_launch_options() {
        let tree = vdf::parse(SAMPLE).unwrap();
        assert_eq!(
            vdf::get_str(rust_app(&tree), LAUNCH_OPTIONS_KEY),
            Some("-graphics.shadowmode \"1\" -tree.quality \"500\"")
        );
    }

    #[test]
    fn round_trips_escaped_quotes() {
        let tree = vdf::parse(SAMPLE).unwrap();
        let reparsed = vdf::parse(&vdf::serialize(&tree)).unwrap();
        assert_eq!(
            vdf::get_str(rust_app(&reparsed), LAUNCH_OPTIONS_KEY),
            Some("-graphics.shadowmode \"1\" -tree.quality \"500\"")
        );
    }

    #[test]
    fn set_overwrites_existing() {
        let mut tree = vdf::parse(SAMPLE).unwrap();
        let app = vdf::ensure_object(ensure_path(&mut tree, APPS_KEY_PATH), RUST_APP_ID);
        vdf::set_str(app, LAUNCH_OPTIONS_KEY, "-window-mode exclusive");
        assert_eq!(
            vdf::get_str(rust_app(&tree), LAUNCH_OPTIONS_KEY),
            Some("-window-mode exclusive")
        );
    }

    #[test]
    fn set_creates_path_when_missing() {
        let mut tree = vdf::parse("\"UserLocalConfigStore\"\n{\n}\n").unwrap();
        let app = vdf::ensure_object(ensure_path(&mut tree, APPS_KEY_PATH), RUST_APP_ID);
        vdf::set_str(app, LAUNCH_OPTIONS_KEY, "-nolog");
        let reparsed = vdf::parse(&vdf::serialize(&tree)).unwrap();
        assert_eq!(
            vdf::get_str(rust_app(&reparsed), LAUNCH_OPTIONS_KEY),
            Some("-nolog")
        );
    }

    #[test]
    fn clear_removes_key() {
        let mut tree = vdf::parse(SAMPLE).unwrap();
        let app = vdf::ensure_object(ensure_path(&mut tree, APPS_KEY_PATH), RUST_APP_ID);
        vdf::remove_key(app, LAUNCH_OPTIONS_KEY);
        assert_eq!(vdf::get_str(rust_app(&tree), LAUNCH_OPTIONS_KEY), None);
        assert_eq!(
            vdf::get_str(rust_app(&tree), LAST_PLAYED_KEY),
            Some("1783604587")
        );
    }

    #[test]
    fn preserves_windows_path_backslashes() {
        let input = "\"root\"\n{\n\t\"dir\"\t\t\"C:\\\\Games\\\\Steam\"\n}\n";
        let tree = vdf::parse(input).unwrap();
        let reparsed = vdf::parse(&vdf::serialize(&tree)).unwrap();
        let root = vdf::get_obj(&reparsed, "root").unwrap();
        assert_eq!(vdf::get_str(root, "dir"), Some("C:\\Games\\Steam"));
    }
}
