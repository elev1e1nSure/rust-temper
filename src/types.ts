export interface Bind {
  key: string;
  command: string;
}

export interface BackupFileStatus {
  name: string;
  backedUp: boolean;
  sourceExists: boolean;
}

export interface BackupStatus {
  exists: boolean;
  createdAtEpochSeconds: number | null;
  backupDir: string;
  files: BackupFileStatus[];
}

export interface FilteredBind {
  bind: Bind;
  sourceIndex: number;
}

export interface CommandPreset {
  name: string;
  command: string;
  kind: "single" | "combination";
  defaultMode: "hold" | "toggle";
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
