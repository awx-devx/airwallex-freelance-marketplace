import { readFileSync, writeFileSync } from "node:fs";
import { findingsPath } from "./paths";

export function recordFinding(section: string, body: string): void {
  const start = `<!-- ${section} -->`;
  const end = `<!-- /${section} -->`;
  const current = readFileSync(findingsPath, "utf8");
  const pattern = new RegExp(`${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}`);
  if (!pattern.test(current)) {
    throw new Error(`scripts/spike/FINDINGS.md is missing the ${section} markers`);
  }
  const next = current.replace(pattern, `${start}\n\n${body.trim()}\n\n${end}`);
  writeFileSync(findingsPath, next);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
