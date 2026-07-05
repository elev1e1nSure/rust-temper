import type { Bind } from "./types";

export const PVP_PRESET: Bind[] = [
  { key: "leftctrl", command: "+duck" },
  { key: "space", command: "+jump" },
  { key: "q", command: "+slot6" },
  { key: "mouse0", command: "+attack" },
  { key: "mouse1", command: "+attack2" },
  { key: "t", command: "chat.open" },
  { key: "tab", command: "inventory.toggle" },
  { key: "a", command: "+forward" },
  { key: "d", command: "+right" },
  { key: "f", command: "+backward" },
  { key: "r", command: "+reload" },
  { key: "e", command: "+use" },
  { key: "x", command: "+sprint" },
  { key: "1", command: "+slot1" },
  { key: "2", command: "+slot2" },
  { key: "3", command: "+slot3" },
];

export const BUILDING_PRESET: Bind[] = [
  { key: "leftctrl", command: "+duck" },
  { key: "e", command: "+use" },
  { key: "mouse0", command: "+attack" },
  { key: "tab", command: "inventory.toggle" },
  { key: "a", command: "+forward" },
  { key: "d", command: "+right" },
  { key: "f", command: "+backward" },
  { key: "1", command: "+slot1" },
  { key: "2", command: "+slot2" },
];
