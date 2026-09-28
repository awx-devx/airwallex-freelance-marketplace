export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };

export function asObject(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

export function asJsonObject(value: unknown): JsonObject | undefined {
  return asObject(value) as JsonObject | undefined;
}

export function readString(value: unknown, key: string): string | undefined {
  const raw = asObject(value)?.[key];
  return typeof raw === "string" ? raw : undefined;
}

export function readNumber(value: unknown, key: string): number | undefined {
  const raw = asObject(value)?.[key];
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim() !== "" && Number.isFinite(Number(raw))) return Number(raw);
  return undefined;
}

export function readItems(value: unknown): Record<string, unknown>[] {
  const items = asObject(value)?.items;
  if (!Array.isArray(items)) return [];
  return items.filter((item): item is Record<string, unknown> => !!asObject(item));
}
