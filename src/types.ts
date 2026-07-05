export interface Bind {
  key: string;
  command: string;
}

export interface CommandPreset {
  name: string;
  command: string;
  description: string;
}

export type TweakValueType = { type: "bool"; on: string; off: string };

export interface TweakDef {
  key: string;
  title: string;
  description: string;
  valueType: TweakValueType;
  default: string;
}
