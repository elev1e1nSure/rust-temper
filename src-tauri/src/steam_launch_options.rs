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
    let tree = parse(&client_cfg::read(&path)?)?;
    Ok(app_object(&tree, RUST_APP_ID)
        .and_then(|app| get_str(app, LAUNCH_OPTIONS_KEY))
        .map(str::to_string))
}

/// Create or overwrite Rust's launch options with `options`.
#[tauri::command]
pub fn set_rust_launch_options(options: String) -> Result<(), String> {
    mutate(|app| {
        set_str(app, LAUNCH_OPTIONS_KEY, &options);
    })
}

/// Remove Rust's launch options entirely (reverts to empty).
#[tauri::command]
pub fn clear_rust_launch_options() -> Result<(), String> {
    mutate(|app| {
        remove_key(app, LAUNCH_OPTIONS_KEY);
    })
}

/// Shared read-modify-write skeleton: stop Steam, load the file, mutate the Rust
/// app object (creating the key path if the account has never launched Rust),
/// then write atomically. Serialized against tweak/graphics writes via the same
/// process-wide lock so concurrent invokes can't clobber each other.
fn mutate(edit: impl FnOnce(&mut Vec<Member>)) -> Result<(), String> {
    let _guard = client_cfg::operation_lock()?;
    steam::unload_before_config_write()?;

    let path = locate_localconfig()?;
    let mut tree = parse(&client_cfg::read(&path)?)?;
    let apps = ensure_path(&mut tree, APPS_KEY_PATH);
    let app = ensure_object(apps, RUST_APP_ID);
    edit(app);

    client_cfg::write_atomic(&path, &serialize(&tree))?;
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
        return Err("Не найден файл localconfig.vdf Steam. Убедитесь, что Steam установлен и вы входили в аккаунт".to_string());
    }

    let best = candidates
        .into_iter()
        .map(|path| {
            let last_played = std::fs::read_to_string(&path)
                .ok()
                .and_then(|content| parse(&content).ok())
                .and_then(|tree| {
                    app_object(&tree, RUST_APP_ID)
                        .and_then(|app| get_str(app, LAST_PLAYED_KEY))
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

type Member = (String, Node);

/// A Valve KeyValues node: either a string leaf or an ordered child object.
/// Order is preserved so re-serializing keeps the file's original layout.
#[derive(Debug, Clone, PartialEq)]
enum Node {
    Str(String),
    Obj(Vec<Member>),
}

/// Case-insensitive lookup of a child string value (Steam treats keys as
/// case-insensitive; e.g. "Steam" vs "steam").
fn get_str<'a>(members: &'a [Member], key: &str) -> Option<&'a str> {
    members.iter().find_map(|(k, node)| match node {
        Node::Str(value) if k.eq_ignore_ascii_case(key) => Some(value.as_str()),
        _ => None,
    })
}

/// Navigate `root > apps > <appid>` and return that app's members, if present.
fn app_object<'a>(root: &'a [Member], appid: &str) -> Option<&'a [Member]> {
    let mut node = root;
    for key in APPS_KEY_PATH {
        node = get_obj(node, key)?;
    }
    get_obj(node, appid)
}

fn get_obj<'a>(members: &'a [Member], key: &str) -> Option<&'a [Member]> {
    members.iter().find_map(|(k, node)| match node {
        Node::Obj(children) if k.eq_ignore_ascii_case(key) => Some(children.as_slice()),
        _ => None,
    })
}

/// Walk (creating missing objects) a chain of object keys, returning the deepest
/// object's members for mutation.
fn ensure_path<'a>(mut members: &'a mut Vec<Member>, keys: &[&str]) -> &'a mut Vec<Member> {
    for key in keys {
        members = ensure_object(members, key);
    }
    members
}

/// Return the child object under `key`, inserting an empty one if absent or if
/// the existing child is a string leaf.
fn ensure_object<'a>(members: &'a mut Vec<Member>, key: &str) -> &'a mut Vec<Member> {
    let index = match members
        .iter()
        .position(|(k, _)| k.eq_ignore_ascii_case(key))
    {
        Some(index) => {
            if !matches!(members[index].1, Node::Obj(_)) {
                members[index].1 = Node::Obj(Vec::new());
            }
            index
        }
        None => {
            members.push((key.to_string(), Node::Obj(Vec::new())));
            members.len() - 1
        }
    };
    match &mut members[index].1 {
        Node::Obj(children) => children,
        _ => unreachable!("just ensured this member is an object"),
    }
}

fn set_str(members: &mut Vec<Member>, key: &str, value: &str) {
    if let Some((_, node)) = members
        .iter_mut()
        .find(|(k, _)| k.eq_ignore_ascii_case(key))
    {
        *node = Node::Str(value.to_string());
    } else {
        members.push((key.to_string(), Node::Str(value.to_string())));
    }
}

fn remove_key(members: &mut Vec<Member>, key: &str) {
    members.retain(|(k, _)| !k.eq_ignore_ascii_case(key));
}

// ── VDF parse ────────────────────────────────────────────────────────────────

/// Parse a Valve KeyValues document into an ordered tree.
fn parse(input: &str) -> Result<Vec<Member>, String> {
    let mut lexer = Lexer::new(input);
    let members = parse_members(&mut lexer, true)?;
    Ok(members)
}

fn parse_members(lexer: &mut Lexer, top_level: bool) -> Result<Vec<Member>, String> {
    let mut members = Vec::new();
    loop {
        let key = match lexer.next_token()? {
            Token::Str(key) => key,
            Token::Close if !top_level => return Ok(members),
            Token::Eof if top_level => return Ok(members),
            Token::Close => return Err("Неожиданный '}' в localconfig.vdf".to_string()),
            Token::Open => return Err("Неожиданный '{' в localconfig.vdf".to_string()),
            Token::Eof => return Err("Неожиданный конец localconfig.vdf".to_string()),
        };
        match lexer.next_token()? {
            Token::Str(value) => members.push((key, Node::Str(value))),
            Token::Open => members.push((key, Node::Obj(parse_members(lexer, false)?))),
            Token::Close | Token::Eof => {
                return Err(format!(
                    "Отсутствует значение для ключа '{key}' в localconfig.vdf"
                ))
            }
        }
    }
}

enum Token {
    Str(String),
    Open,
    Close,
    Eof,
}

struct Lexer {
    chars: Vec<char>,
    pos: usize,
}

impl Lexer {
    fn new(input: &str) -> Self {
        Self {
            chars: input.chars().collect(),
            pos: 0,
        }
    }

    fn next_token(&mut self) -> Result<Token, String> {
        self.skip_trivia();
        match self.chars.get(self.pos) {
            None => Ok(Token::Eof),
            Some('{') => {
                self.pos += 1;
                Ok(Token::Open)
            }
            Some('}') => {
                self.pos += 1;
                Ok(Token::Close)
            }
            Some('"') => Ok(Token::Str(self.read_quoted())),
            Some(_) => Ok(Token::Str(self.read_unquoted())),
        }
    }

    /// Skip whitespace and `//` line comments between tokens.
    fn skip_trivia(&mut self) {
        while let Some(&c) = self.chars.get(self.pos) {
            if c.is_whitespace() {
                self.pos += 1;
            } else if c == '/' && self.chars.get(self.pos + 1) == Some(&'/') {
                while let Some(&c) = self.chars.get(self.pos) {
                    self.pos += 1;
                    if c == '\n' {
                        break;
                    }
                }
            } else {
                break;
            }
        }
    }

    fn read_quoted(&mut self) -> String {
        self.pos += 1; // opening quote
        let mut out = String::new();
        while let Some(&c) = self.chars.get(self.pos) {
            self.pos += 1;
            match c {
                '"' => break,
                '\\' => match self.chars.get(self.pos) {
                    Some(&escaped) => {
                        self.pos += 1;
                        out.push(match escaped {
                            'n' => '\n',
                            't' => '\t',
                            'r' => '\r',
                            other => other, // covers \" and \\ , drops unknown backslash
                        });
                    }
                    None => out.push('\\'),
                },
                _ => out.push(c),
            }
        }
        out
    }

    fn read_unquoted(&mut self) -> String {
        let mut out = String::new();
        while let Some(&c) = self.chars.get(self.pos) {
            if c.is_whitespace() || c == '{' || c == '}' || c == '"' {
                break;
            }
            out.push(c);
            self.pos += 1;
        }
        out
    }
}

// ── VDF serialize ────────────────────────────────────────────────────────────

/// Serialize the tree back to Valve KeyValues text, tab-indented in Steam's
/// style. Steam re-reads whitespace-insensitively, so exact original spacing is
/// not preserved — only structure and order.
fn serialize(members: &[Member]) -> String {
    let mut out = String::new();
    write_members(&mut out, members, 0);
    out
}

fn write_members(out: &mut String, members: &[Member], depth: usize) {
    let indent = "\t".repeat(depth);
    for (key, node) in members {
        match node {
            Node::Str(value) => {
                out.push_str(&format!(
                    "{indent}\"{}\"\t\t\"{}\"\n",
                    escape(key),
                    escape(value)
                ));
            }
            Node::Obj(children) => {
                out.push_str(&format!("{indent}\"{}\"\n{indent}{{\n", escape(key)));
                write_members(out, children, depth + 1);
                out.push_str(&format!("{indent}}}\n"));
            }
        }
    }
}

fn escape(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for c in value.chars() {
        match c {
            '\\' => out.push_str("\\\\"),
            '"' => out.push_str("\\\""),
            '\n' => out.push_str("\\n"),
            '\t' => out.push_str("\\t"),
            '\r' => out.push_str("\\r"),
            _ => out.push(c),
        }
    }
    out
}

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
        let tree = parse(SAMPLE).unwrap();
        assert_eq!(
            get_str(rust_app(&tree), LAUNCH_OPTIONS_KEY),
            Some("-graphics.shadowmode \"1\" -tree.quality \"500\"")
        );
    }

    #[test]
    fn round_trips_escaped_quotes() {
        let tree = parse(SAMPLE).unwrap();
        let reparsed = parse(&serialize(&tree)).unwrap();
        assert_eq!(
            get_str(rust_app(&reparsed), LAUNCH_OPTIONS_KEY),
            Some("-graphics.shadowmode \"1\" -tree.quality \"500\"")
        );
    }

    #[test]
    fn set_overwrites_existing() {
        let mut tree = parse(SAMPLE).unwrap();
        let app = ensure_object(ensure_path(&mut tree, APPS_KEY_PATH), RUST_APP_ID);
        set_str(app, LAUNCH_OPTIONS_KEY, "-window-mode exclusive");
        assert_eq!(
            get_str(rust_app(&tree), LAUNCH_OPTIONS_KEY),
            Some("-window-mode exclusive")
        );
    }

    #[test]
    fn set_creates_path_when_missing() {
        let mut tree = parse("\"UserLocalConfigStore\"\n{\n}\n").unwrap();
        let app = ensure_object(ensure_path(&mut tree, APPS_KEY_PATH), RUST_APP_ID);
        set_str(app, LAUNCH_OPTIONS_KEY, "-nolog");
        // Survives a serialize/parse round-trip in the correct nested location.
        let reparsed = parse(&serialize(&tree)).unwrap();
        assert_eq!(
            get_str(rust_app(&reparsed), LAUNCH_OPTIONS_KEY),
            Some("-nolog")
        );
    }

    #[test]
    fn clear_removes_key() {
        let mut tree = parse(SAMPLE).unwrap();
        let app = ensure_object(ensure_path(&mut tree, APPS_KEY_PATH), RUST_APP_ID);
        remove_key(app, LAUNCH_OPTIONS_KEY);
        assert_eq!(get_str(rust_app(&tree), LAUNCH_OPTIONS_KEY), None);
        // LastPlayed sibling is untouched.
        assert_eq!(
            get_str(rust_app(&tree), LAST_PLAYED_KEY),
            Some("1783604587")
        );
    }

    #[test]
    fn preserves_windows_path_backslashes() {
        let input = "\"root\"\n{\n\t\"dir\"\t\t\"C:\\\\Games\\\\Steam\"\n}\n";
        let tree = parse(input).unwrap();
        let reparsed = parse(&serialize(&tree)).unwrap();
        let root = get_obj(&reparsed, "root").unwrap();
        assert_eq!(get_str(root, "dir"), Some("C:\\Games\\Steam"));
    }
}
