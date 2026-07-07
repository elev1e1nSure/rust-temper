export interface Bind {
  key: string;
  command: string;
}

export interface FilteredBind {
  bind: Bind;
  sourceIndex: number;
}

// Every bind kept mounted for the list, tagged with whether the current
// filter matches it — non-matches collapse (animated) instead of unmounting.
export interface DisplayBind extends FilteredBind {
  matched: boolean;
}

export interface CommandPreset {
  name: string;
  command: string;
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

export interface BindTweak {
  defaultKey: string;
  command: string;
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
  bind?: BindTweak;
}
