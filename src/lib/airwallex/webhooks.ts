import { createHmac, timingSafeEqual } from "node:crypto";

const TOLERANCE_MS = 5 * 60 * 1000;

export function verifyAirwallexSignature(
  rawBody: string,
  timestamp: string | null,
  signature: string | null,
  secret: string,
  nowMs = Date.now(),
): boolean {
  if (!timestamp || !signature) return false;
  const expected = createHmac("sha256", secret).update(timestamp + rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  // AIRWALLEX: tolerance is ours to choose; 5 minutes guards against replay.
  // https://www.airwallex.com/docs/developer-tools/webhooks/listen-for-webhook-events
  const age = Math.abs(nowMs - Number(timestamp));
  return Number.isFinite(age) && age < TOLERANCE_MS;
}

export function extractObject(evt: unknown): unknown {
  if (!evt || typeof evt !== "object") return {};
  const data = (evt as { data?: unknown }).data;
  if (data && typeof data === "object" && "object" in data) {
    return (data as { object?: unknown }).object ?? {};
  }
  return data ?? {};
}

export function extractAccountId(evt: unknown): string | undefined {
  if (!evt || typeof evt !== "object") return undefined;
  const record = evt as { account_id?: unknown; accountId?: unknown };
  if (typeof record.account_id === "string") return record.account_id;
  if (typeof record.accountId === "string") return record.accountId;
  return undefined;
}
