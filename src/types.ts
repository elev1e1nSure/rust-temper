export interface Bind {
  key: string;
  command: string;
}

export interface CommandPreset {
  name: string;
  command: string;
  description: string;
  kind: "single" | "combination";
}

export interface BackendKeyRule {
  key: string;
  on: string;
  off: string;
}

export interface AdvancedSlider {
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  label: string;
  valueFormat?: string;
}

export type TweakSection = "qol" | "graphics" | "interface";
export type TweakBadge = "recommended";

export interface TweakDef {
  key: string;
  title: string;
  description: string;
  section: TweakSection;
  badge?: TweakBadge;
  backendKeys: BackendKeyRule[];
  advancedSlider?: AdvancedSlider;
}
