// Static keyboard layout for the binds page. `rustKey` is the token written to
// keys.cfg (`bind <rustKey> <command>`); it is both what a click assigns and
// what the highlight matches against, so a bind is highlighted when some
// bind.key equals a cap's rustKey. Keys with no `rustKey` (FN, decorative
// labels) are non-bindable and rendered dimmed.

import { parseCombo, normalizeRustKey } from "./utils/bindKey";

export interface KeyDef {
  label: string;
  rustKey?: string;
  /** width in key-units, default 1 */
  w?: number;
}

export interface NumpadCell extends KeyDef {
  r: number;
  c: number;
  rowSpan?: number;
  colSpan?: number;
}

// Function/system row, grouped so gaps between clusters match a real keyboard.
export const FN_GROUPS: KeyDef[][] = [
  [{ label: "ESC", rustKey: "escape" }],
  [
    { label: "F1", rustKey: "f1" },
    { label: "F2", rustKey: "f2" },
    { label: "F3", rustKey: "f3" },
    { label: "F4", rustKey: "f4" },
  ],
  [
    { label: "F5", rustKey: "f5" },
    { label: "F6", rustKey: "f6" },
    { label: "F7", rustKey: "f7" },
    { label: "F8", rustKey: "f8" },
  ],
  [
    { label: "F9", rustKey: "f9" },
    { label: "F10", rustKey: "f10" },
    { label: "F11", rustKey: "f11" },
    { label: "F12", rustKey: "f12" },
  ],
  [
    { label: "PRT", rustKey: "printscreen" },
    { label: "SCR", rustKey: "scrolllock" },
    { label: "PSE", rustKey: "pause" },
  ],
  [
    { label: "F13", rustKey: "f13" },
    { label: "F14", rustKey: "f14" },
    { label: "F15", rustKey: "f15" },
    { label: "F16", rustKey: "f16" },
  ],
];

// Main alphanumeric block. Every row totals 15 key-units.
export const MAIN_ROWS: KeyDef[][] = [
  [
    { label: "`", rustKey: "`" },
    { label: "1", rustKey: "1" },
    { label: "2", rustKey: "2" },
    { label: "3", rustKey: "3" },
    { label: "4", rustKey: "4" },
    { label: "5", rustKey: "5" },
    { label: "6", rustKey: "6" },
    { label: "7", rustKey: "7" },
    { label: "8", rustKey: "8" },
    { label: "9", rustKey: "9" },
    { label: "0", rustKey: "0" },
    { label: "-", rustKey: "-" },
    { label: "+", rustKey: "=" },
    { label: "←", rustKey: "backspace", w: 2 },
  ],
  [
    { label: "TAB", rustKey: "tab", w: 1.5 },
    { label: "Q", rustKey: "q" },
    { label: "W", rustKey: "w" },
    { label: "E", rustKey: "e" },
    { label: "R", rustKey: "r" },
    { label: "T", rustKey: "t" },
    { label: "Y", rustKey: "y" },
    { label: "U", rustKey: "u" },
    { label: "I", rustKey: "i" },
    { label: "O", rustKey: "o" },
    { label: "P", rustKey: "p" },
    { label: "[", rustKey: "[" },
    { label: "]", rustKey: "]" },
    { label: "\\", rustKey: "\\", w: 1.5 },
  ],
  [
    { label: "CAPSLK", rustKey: "capslock", w: 1.75 },
    { label: "A", rustKey: "a" },
    { label: "S", rustKey: "s" },
    { label: "D", rustKey: "d" },
    { label: "F", rustKey: "f" },
    { label: "G", rustKey: "g" },
    { label: "H", rustKey: "h" },
    { label: "J", rustKey: "j" },
    { label: "K", rustKey: "k" },
    { label: "L", rustKey: "l" },
    { label: ";", rustKey: ";" },
    { label: "'", rustKey: "'" },
    { label: "ENTER", rustKey: "enter", w: 2.25 },
  ],
  [
    { label: "SHIFT", rustKey: "leftshift", w: 2.25 },
    { label: "Z", rustKey: "z" },
    { label: "X", rustKey: "x" },
    { label: "C", rustKey: "c" },
    { label: "V", rustKey: "v" },
    { label: "B", rustKey: "b" },
    { label: "N", rustKey: "n" },
    { label: "M", rustKey: "m" },
    { label: ",", rustKey: "," },
    { label: ".", rustKey: "." },
    { label: "/", rustKey: "/" },
    { label: "SHIFT", rustKey: "rightshift", w: 2.75 },
  ],
  [
    { label: "CTRL", rustKey: "leftctrl", w: 1.25 },
    { label: "WIN", rustKey: "leftwin", w: 1.25 },
    { label: "ALT", rustKey: "leftalt", w: 1.25 },
    { label: "_", rustKey: "space", w: 7.5 },
    { label: "ALT", rustKey: "rightalt", w: 1.25 },
    { label: "FN", w: 1.25 },
    { label: "CTRL", rustKey: "rightctrl", w: 1.25 },
  ],
];

// Navigation cluster (INS/HME/PUP · DEL/END/PDN · arrows). 3 units wide.
export const NAV_ROWS: (KeyDef | null)[][] = [
  [
    { label: "INS", rustKey: "insert" },
    { label: "HME", rustKey: "home" },
    { label: "PUP", rustKey: "pageup" },
  ],
  [
    { label: "DEL", rustKey: "delete" },
    { label: "END", rustKey: "end" },
    { label: "PDN", rustKey: "pagedown" },
  ],
  [null, null, null],
  [null, { label: "↑", rustKey: "uparrow" }, null],
  [
    { label: "←", rustKey: "leftarrow" },
    { label: "↓", rustKey: "downarrow" },
    { label: "→", rustKey: "rightarrow" },
  ],
];

// Numeric keypad, placed on an explicit 4-column grid so +/ENTER can span rows.
export const NUMPAD_CELLS: NumpadCell[] = [
  { label: "NUM", rustKey: "numlock", r: 1, c: 1 },
  { label: "/", rustKey: "kp_divide", r: 1, c: 2 },
  { label: "*", rustKey: "kp_multiply", r: 1, c: 3 },
  { label: "-", rustKey: "kp_minus", r: 1, c: 4 },
  { label: "7", rustKey: "kp7", r: 2, c: 1 },
  { label: "8", rustKey: "kp8", r: 2, c: 2 },
  { label: "9", rustKey: "kp9", r: 2, c: 3 },
  { label: "+", rustKey: "kp_plus", r: 2, c: 4, rowSpan: 2 },
  { label: "4", rustKey: "kp4", r: 3, c: 1 },
  { label: "5", rustKey: "kp5", r: 3, c: 2 },
  { label: "6", rustKey: "kp6", r: 3, c: 3 },
  { label: "1", rustKey: "kp1", r: 4, c: 1 },
  { label: "2", rustKey: "kp2", r: 4, c: 2 },
  { label: "3", rustKey: "kp3", r: 4, c: 3 },
  { label: "ENT", rustKey: "kp_enter", r: 4, c: 4, rowSpan: 2 },
  { label: "0", rustKey: "kp0", r: 5, c: 1, colSpan: 2 },
  { label: ".", rustKey: "kp_dot", r: 5, c: 3 },
];

// Human-facing names for key badges in the bind list (reference uses Russian).
const DISPLAY_NAMES: Record<string, string> = {
  space: "Пробел",
  enter: "Enter",
  tab: "Tab",
  capslock: "Caps Lock",
  escape: "Esc",
  backspace: "Backspace",
  leftshift: "Левый Shift",
  rightshift: "Правый Shift",
  leftctrl: "Левый Ctrl",
  rightctrl: "Правый Ctrl",
  leftalt: "Левый Alt",
  rightalt: "Правый Alt",
  leftwin: "Win",
  uparrow: "↑",
  downarrow: "↓",
  leftarrow: "←",
  rightarrow: "→",
  insert: "Insert",
  delete: "Delete",
  home: "Home",
  end: "End",
  pageup: "Page Up",
  pagedown: "Page Down",
  printscreen: "Print Screen",
  scrolllock: "Scroll Lock",
  pause: "Pause",
  numlock: "Num Lock",
  kp_divide: "Num /",
  kp_multiply: "Num *",
  kp_minus: "Num -",
  kp_plus: "Num +",
  kp_enter: "Num Enter",
  kp_dot: "Num .",
  // Rust follows Unity mouse indexing: mouse0 = left, mouse1 = right,
  // mouse2 = middle, mouse3+ = side buttons.
  mouse0: "ЛКМ",
  mouse1: "ПКМ",
  mouse2: "СКМ",
  mouse3: "Мышь 3",
  mouse4: "Мышь 4",
  mouse5: "Мышь 5",
  mouse6: "Мышь 6",
};

export function keyDisplayName(rustKey: string): string {
  if (!rustKey) return "—";
  // Combination bind, stored by Rust as "[a+b]" — display each part.
  const parts = parseCombo(rustKey);
  if (parts.length > 1) return parts.map(keyDisplayName).join(" + ");
  const firstPart = parts[0];
  if (!firstPart) return rustKey;

  const combo = normalizeRustKey(firstPart);
  if (!combo) return rustKey;

  if (DISPLAY_NAMES[combo]) return DISPLAY_NAMES[combo];
  const kp = combo.match(/^kp(\d)$/);
  if (kp) return `Num ${kp[1]}`;
  return combo.toUpperCase();
}
