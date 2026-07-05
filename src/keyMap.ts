const KEY_NAME_MAP: Record<string, string> = {
  " ": "space",
  control: "leftctrl",
  shift: "leftshift",
  alt: "leftalt",
  capslock: "capslock",
  escape: "escape",
  enter: "enter",
  backspace: "backspace",
  tab: "tab",
  arrowup: "uparrow",
  arrowdown: "downarrow",
  arrowleft: "leftarrow",
  arrowright: "rightarrow",
  insert: "insert",
  delete: "delete",
  home: "home",
  end: "end",
  pageup: "pageup",
  pagedown: "pagedown",
  f1: "f1",
  f2: "f2",
  f3: "f3",
  f4: "f4",
  f5: "f5",
  f6: "f6",
  f7: "f7",
  f8: "f8",
  f9: "f9",
  f10: "f10",
  f11: "f11",
  f12: "f12",
};

export function keyNameFromEvent(e: KeyboardEvent): string {
  const raw = e.key.toLowerCase();
  return KEY_NAME_MAP[raw] ?? raw;
}
