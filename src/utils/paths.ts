function joinCfgPath(gamePath: string, fileName: string): string {
  const root = gamePath.replace(/[\\/]+$/, "");
  return `${root}\\cfg\\${fileName}`;
}

export function keysCfgPathFor(gamePath: string): string {
  return joinCfgPath(gamePath, "keys.cfg");
}

export function clientCfgPathFor(gamePath: string): string {
  return joinCfgPath(gamePath, "client.cfg");
}
