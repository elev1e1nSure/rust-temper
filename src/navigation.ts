import { KeyboardLine, MonitorLine, Settings6Fill } from "@mingcute/react";
import { GearFillIcon } from "./icons";

export const NAV_ITEMS = [
  { id: "binds", label: "Бинды", icon: KeyboardLine },
  { id: "tweaks", label: "Твики", icon: Settings6Fill },
  { id: "graphics", label: "Графика", icon: MonitorLine },
  { id: "settings", label: "Настройки", icon: GearFillIcon },
] as const;

export type PageId = (typeof NAV_ITEMS)[number]["id"];
