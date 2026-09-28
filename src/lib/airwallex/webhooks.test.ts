import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { extractAccountId, extractObject, verifyAirwallexSignature } from "@/lib/airwallex/webhooks";

const secret = "whsec_test";
const now = 1_700_000_000_000;

function sign(timestamp: string, raw: string, key = secret): string {
  return createHmac("sha256", key).update(timestamp + raw).digest("hex");
}

describe("verifyAirwallexSignature", () => {
  const raw = JSON.stringify({ id: "evt_1", name: "payment_intent.succeeded" });
  const timestamp = String(now);

  it("accepts a raw-body HMAC inside the tolerance window", () => {
    expect(verifyAirwallexSignature(raw, timestamp, sign(timestamp, raw), secret, now)).toBe(true);
  });

  it("rejects a re-serialized body, a wrong secret, and a stale timestamp", () => {
    const signature = sign(timestamp, raw);
    expect(verifyAirwallexSignature(`${raw} `, timestamp, signature, secret, now)).toBe(false);
    expect(verifyAirwallexSignature(raw, timestamp, signature, "other-secret", now)).toBe(false);
    expect(verifyAirwallexSignature(raw, timestamp, signature, secret, now + 6 * 60 * 1000)).toBe(false);
    expect(verifyAirwallexSignature(raw, null, signature, secret, now)).toBe(false);
  });
});

describe("webhook normalizer", () => {
  it("reads data.object and account_id", () => {
    const evt = { account_id: "acct_1", data: { object: { id: "int_1" } } };
    expect(extractObject(evt)).toEqual({ id: "int_1" });
    expect(extractAccountId(evt)).toBe("acct_1");
  });

  it("falls back to data and accountId", () => {
    const evt = { accountId: "acct_2", data: { id: "ch_1" } };
    expect(extractObject(evt)).toEqual({ id: "ch_1" });
    expect(extractAccountId(evt)).toBe("acct_2");
  });
});
