//! Valve KeyValues (VDF) parser and serializer.
//!
//! Handles the Steam `localconfig.vdf` / `libraryfolders.vdf` format: ordered
//! key-value pairs nested via `{}` blocks, double-quoted strings with C-style
//! escape sequences (`\\`, `\"`, `\n`, `\t`), and `//` line comments.
//!
//! Whitespace-insensitive on read; re-serializes with tab indentation in
//! Steam's style. Order of top-level keys and siblings is preserved.

pub type Member = (String, Node);

#[derive(Debug, Clone, PartialEq)]
pub enum Node {
    Str(String),
    Obj(Vec<Member>),
}

/// Case-insensitive lookup of a child string value.
pub fn get_str<'a>(members: &'a [Member], key: &str) -> Option<&'a str> {
    members.iter().find_map(|(k, node)| match node {
        Node::Str(value) if k.eq_ignore_ascii_case(key) => Some(value.as_str()),
        _ => None,
    })
}

/// Case-insensitive lookup returning the children of a child object.
pub fn get_obj<'a>(members: &'a [Member], key: &str) -> Option<&'a [Member]> {
    members.iter().find_map(|(k, node)| match node {
        Node::Obj(children) if k.eq_ignore_ascii_case(key) => Some(children.as_slice()),
        _ => None,
    })
}

/// Upsert a child object, returning its members for mutation.
pub fn ensure_object<'a>(members: &'a mut Vec<Member>, key: &str) -> &'a mut Vec<Member> {
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

pub fn set_str(members: &mut Vec<Member>, key: &str, value: &str) {
    if let Some((_, node)) = members
        .iter_mut()
        .find(|(k, _)| k.eq_ignore_ascii_case(key))
    {
        *node = Node::Str(value.to_string());
    } else {
        members.push((key.to_string(), Node::Str(value.to_string())));
    }
}

pub fn remove_key(members: &mut Vec<Member>, key: &str) {
    members.retain(|(k, _)| !k.eq_ignore_ascii_case(key));
}

// ── Parser ────────────────────────────────────────────────────────────────────

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
        self.pos += 1;
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
                            other => other,
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

pub fn parse(input: &str) -> Result<Vec<Member>, String> {
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
            Token::Close => return Err("Неожиданный '}' в VDF".to_string()),
            Token::Open => return Err("Неожиданный '{' в VDF".to_string()),
            Token::Eof => return Err("Неожиданный конец VDF".to_string()),
        };
        match lexer.next_token()? {
            Token::Str(value) => members.push((key, Node::Str(value))),
            Token::Open => members.push((key, Node::Obj(parse_members(lexer, false)?))),
            Token::Close | Token::Eof => {
                return Err(format!("Отсутствует значение для ключа '{key}' в VDF"))
            }
        }
    }
}

// ── Serializer ────────────────────────────────────────────────────────────────

pub fn serialize(members: &[Member]) -> String {
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

    fn navigate<'a>(members: &'a [Member], path: &[&str]) -> Option<&'a [Member]> {
        let mut node = members;
        for key in path {
            node = get_obj(node, key)?;
        }
        Some(node)
    }

    #[test]
    fn parse_and_navigate() {
        let tree = parse(SAMPLE).unwrap();
        let apps = navigate(&tree, &["UserLocalConfigStore", "Software", "Valve", "Steam", "apps"])
            .unwrap();
        let rust = get_obj(apps, "252490").unwrap();
        assert_eq!(
            get_str(rust, "LaunchOptions"),
            Some("-graphics.shadowmode \"1\" -tree.quality \"500\"")
        );
    }

    #[test]
    fn round_trips_escaped_quotes() {
        let tree = parse(SAMPLE).unwrap();
        let reparsed = parse(&serialize(&tree)).unwrap();
        let apps = navigate(
            &reparsed,
            &["UserLocalConfigStore", "Software", "Valve", "Steam", "apps"],
        )
        .unwrap();
        let rust = get_obj(apps, "252490").unwrap();
        assert_eq!(
            get_str(rust, "LaunchOptions"),
            Some("-graphics.shadowmode \"1\" -tree.quality \"500\"")
        );
    }

    #[test]
    fn set_overwrites_existing() {
        let mut tree = parse(SAMPLE).unwrap();
        let apps =
            navigate_mut(&mut tree, &["UserLocalConfigStore", "Software", "Valve", "Steam", "apps"])
                .unwrap();
        let rust = ensure_object(apps, "252490");
        set_str(rust, "LaunchOptions", "-window-mode exclusive");
        assert_eq!(
            get_str(rust, "LaunchOptions"),
            Some("-window-mode exclusive")
        );
    }

    fn navigate_mut<'a>(members: &'a mut Vec<Member>, path: &[&str]) -> Option<&'a mut Vec<Member>> {
        let mut node = members;
        for key in path {
            node = get_obj_mut(node, key)?;
        }
        Some(node)
    }

    fn get_obj_mut<'a>(members: &'a mut Vec<Member>, key: &str) -> Option<&'a mut Vec<Member>> {
        members.iter_mut().find_map(|(k, node)| match node {
            Node::Obj(children) if k.eq_ignore_ascii_case(key) => Some(children),
            _ => None,
        })
    }

    #[test]
    fn set_creates_path_when_missing() {
        let mut tree = parse("\"UserLocalConfigStore\"\n{\n}\n").unwrap();
        let apps = ensure_object(
            ensure_object(
                ensure_object(
                    ensure_object(
                        ensure_object(&mut tree, "UserLocalConfigStore"),
                        "Software",
                    ),
                    "Valve",
                ),
                "Steam",
            ),
            "apps",
        );
        let rust = ensure_object(apps, "252490");
        set_str(rust, "LaunchOptions", "-nolog");
        let reparsed = parse(&serialize(&tree)).unwrap();
        let apps = navigate(
            &reparsed,
            &["UserLocalConfigStore", "Software", "Valve", "Steam", "apps"],
        )
        .unwrap();
        let rust = get_obj(apps, "252490").unwrap();
        assert_eq!(get_str(rust, "LaunchOptions"), Some("-nolog"));
    }

    #[test]
    fn clear_removes_key() {
        let mut tree = parse(SAMPLE).unwrap();
        let apps =
            navigate_mut(&mut tree, &["UserLocalConfigStore", "Software", "Valve", "Steam", "apps"])
                .unwrap();
        let rust = ensure_object(apps, "252490");
        remove_key(rust, "LaunchOptions");
        assert_eq!(get_str(rust, "LaunchOptions"), None);
        assert_eq!(get_str(rust, "LastPlayed"), Some("1783604587"));
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
