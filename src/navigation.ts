import {
  DisplayFill,
  Keyboard2Fill,
  Magic3Fill,
  RocketFill,
  Settings7Fill,
} from "@mingcute/react";

export const NAV_ITEMS = [
  { id: "binds", label: "Бинды", icon: Keyboard2Fill },
  { id: "tweaks", label: "Твики", icon: Magic3Fill },
  { id: "optimization", label: "Оптимизация", icon: RocketFill },
  { id: "graphics", label: "Графика", icon: DisplayFill },
  { id: "settings", label: "Настройки", icon: Settings7Fill },
] as const;

export type PageId = (typeof NAV_ITEMS)[number]["id"];
