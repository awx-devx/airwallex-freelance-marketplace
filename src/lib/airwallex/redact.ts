const SECRET_KEYS = new Set([
  "client_secret",
  "token",
  "api_key",
  "x-api-key",
  "secret",
  "webhook_secret",
]);

/** Recursively replace credential-like fields. Used before logs are written. */
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
  if (!record) return value;

  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(record)) {
    out[key] = SECRET_KEYS.has(key.toLowerCase()) ? "[redacted]" : redact(child);
  }
  return out;
}
