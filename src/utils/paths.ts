export function clientCfgPathFor(keysCfgPath: string): string {
  return keysCfgPath.replace(/keys\.cfg$/i, "client.cfg");
}
