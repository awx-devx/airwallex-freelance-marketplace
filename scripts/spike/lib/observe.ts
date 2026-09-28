import { readItems, readNumber, readString } from "@/lib/airwallex/json";
import { breakdown, type FeeConfig } from "@/services/fees";

export const SPIKE_OFFER_ID = "spike-card";
export const SPIKE_CURRENCY = "USD";
export const SPIKE_AMOUNT_MINOR = 10_000;
export const SPIKE_TOP_UP_MINOR = 5_000;
export const SPIKE_CHARGE_MINOR = 1_000;

export function feeConfig(): FeeConfig {
  return {
    platformFeePercent: Number(process.env.PLATFORM_FEE_PERCENT ?? "10"),
    processingReservePercent: Number(process.env.PROCESSING_RESERVE_PERCENT ?? "2"),
  };
}

export function spikeBreakdown() {
  return breakdown(SPIKE_AMOUNT_MINOR, feeConfig());
}

export function usdAvailable(balances: unknown): string {
  if (!Array.isArray(balances)) return "response was not an array";
  const row = balances.find((item) => {
    return readString(item, "currency") === "USD" && (readString(item, "account_type") ?? "cash") === "cash";
  });
  const amount = readNumber(row, "available_amount");
  return amount === undefined ? "no USD cash row" : String(amount);
}

export function historyKinds(history: unknown): { sourceTypes: string[]; transactionTypes: string[] } {
  const items = readItems(history);
  const unique = (key: string) =>
    [...new Set(items.map((item) => readString(item, key)).filter((value): value is string => !!value))];
  return { sourceTypes: unique("source_type"), transactionTypes: unique("transaction_type") };
}

const TIER_KEY = /tier|capabilit/i;

export function tierHints(value: unknown, depth = 0, path = ""): string[] {
  if (depth > 3 || !value || typeof value !== "object") return [];
  const hits: string[] = [];
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const here = path ? `${path}.${key}` : key;
    const text = typeof child === "string" ? child : undefined;
    if (TIER_KEY.test(key) || text === "LEDGER" || text === "WITHDRAWAL" || text === "FULL") {
      hits.push(`${here}=${text ?? typeof child}`);
    }
    if (child && typeof child === "object") hits.push(...tierHints(child, depth + 1, here));
  }
  return hits.slice(0, 40);
}
