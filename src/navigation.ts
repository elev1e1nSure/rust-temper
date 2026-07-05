import { KeyboardLine, DocumentLine, Settings6Fill } from "@mingcute/react";
import { TweaksIcon } from "./icons";

export const NAV_ITEMS = [
  { id: "binds", label: "Бинды", icon: KeyboardLine },
  { id: "tweaks", label: "Твики", icon: TweaksIcon },
  { id: "presets", label: "Пресеты", icon: DocumentLine },
  { id: "settings", label: "Настройки", icon: Settings6Fill },
] as const;

export type PageId = (typeof NAV_ITEMS)[number]["id"];
