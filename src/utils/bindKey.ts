export function parseCombo(key: string): string[] {
  return key
    .replace(/^\[|\]$/g, "")
    .split("+")
    .filter(Boolean);
}

// Rust writes keys.cfg using verbose Unity KeyCode tokens (period, keypad7,
// leftcontrol, return, backquote, mouse0…), while our keyboard layout models
// keys with a shorter scheme (".", "kp7", "leftctrl", "enter", "`"). Map the
// Rust token onto our scheme so loaded binds highlight the right cap and never
// render as a raw "PERIOD"-style word. Display/matching only — the original
// token is preserved verbatim when writing back to the file.
const RUST_KEY_ALIASES: Record<string, string> = {
  return: "enter",
  backquote: "`",
  period: ".",
  comma: ",",
  slash: "/",
  backslash: "\\",
  semicolon: ";",
  quote: "'",
  leftbracket: "[",
  rightbracket: "]",
  minus: "-",
  equals: "=",
  equal: "=",
  leftcontrol: "leftctrl",
  rightcontrol: "rightctrl",
  leftwindows: "leftwin",
  rightwindows: "leftwin",
  keypaddivide: "kp_divide",
  keypadmultiply: "kp_multiply",
  keypadminus: "kp_minus",
  keypadplus: "kp_plus",
  keypadenter: "kp_enter",
  keypadperiod: "kp_dot",
  numpadenter: "kp_enter",
  numpadplus: "kp_plus",
  numpadminus: "kp_minus",
  numpadmultiply: "kp_multiply",
  numpaddivide: "kp_divide",
  print: "printscreen",
  sysreq: "printscreen",
};

export function normalizeRustKey(token: string | null | undefined): string {
  const t = (token ?? "").trim().toLowerCase();
  if (RUST_KEY_ALIASES[t]) return RUST_KEY_ALIASES[t];
  const kp = t.match(/^keypad([0-9])$/);
  if (kp) return `kp${kp[1]}`;
  const numpad = t.match(/^numpad([0-9])$/);
  if (numpad) return `kp${numpad[1]}`;
  return t;
}

export function formatCombo(parts: string[]): string {
  if (parts.length === 1) return parts[0]!;
  return `[${parts.join("+")}]`;
}
