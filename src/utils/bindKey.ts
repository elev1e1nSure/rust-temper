export function parseCombo(key: string): string[] {
  return key
    .replace(/^\[|\]$/g, "")
    .split("+")
    .filter(Boolean);
}

export function formatCombo(parts: string[]): string {
  if (parts.length === 1) return parts[0];
  return `[${parts.join("+")}]`;
}
