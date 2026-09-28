import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { outDir } from "./paths";

export type SpikeState = {
  sellerAccountId?: string;
  revenueAccountId?: string;
  sellerStatus?: string;
  revenueStatus?: string;
  sellerPayloadLevel?: string;
  revenuePayloadLevel?: string;
  paymentIntentId?: string;
  paymentIntentStatus?: string;
  paymentAttempt?: number;
  clientSecret?: string;
  currency?: string;
  amountMinor?: number;
  sellerSplitId?: string;
  revenueSplitId?: string;
  chargeId?: string;
  transferId?: string;
};

const statePath = () => join(outDir, "state.json");

export function readState(): SpikeState {
  try {
    return JSON.parse(readFileSync(statePath(), "utf8")) as SpikeState;
  } catch {
    return {};
  }
}

export function updateState(patch: Partial<SpikeState>): SpikeState {
  const next = { ...readState(), ...patch };
  mkdirSync(outDir, { recursive: true });
  writeFileSync(statePath(), `${JSON.stringify(next, null, 2)}\n`);
  return next;
}
