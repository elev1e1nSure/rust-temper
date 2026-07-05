import { KeyboardLine, DocumentLine } from "@mingcute/react";
import { TweaksIcon, GearFillIcon } from "./icons";

export const NAV_ITEMS = [
  { id: "binds", label: "Бинды", icon: KeyboardLine },
  { id: "tweaks", label: "Твики", icon: TweaksIcon },
  { id: "presets", label: "Пресеты", icon: DocumentLine },
  { id: "settings", label: "Настройки", icon: GearFillIcon },
] as const;

export type PageId = (typeof NAV_ITEMS)[number]["id"];
