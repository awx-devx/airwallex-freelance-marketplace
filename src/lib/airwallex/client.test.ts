import { describe, expect, it } from "vitest";
import { parseExpiresAt } from "@/lib/airwallex/client";
import { parseAirwallexEnv } from "@/lib/airwallex/env";
import { buildFundsSplitBody } from "@/lib/airwallex/fundsSplits";
import { buildPaymentIntentBody } from "@/lib/airwallex/payments";
import { redact } from "@/lib/airwallex/redact";

describe("parseExpiresAt", () => {
  it("parses Airwallex timestamps that omit the colon in the offset", () => {
    expect(parseExpiresAt("2021-06-18T16:30:00+0000")).toBe(Date.parse("2021-06-18T16:30:00+00:00"));
  });
});

describe("parseAirwallexEnv", () => {
  it("refuses to start when the client id or API key is blank", () => {
    expect(() =>
      parseAirwallexEnv({
        AIRWALLEX_API_BASE: "https://api.sandbox.airwallex.com",
        AIRWALLEX_CLIENT_ID: "",
        AIRWALLEX_API_KEY: "secret",
      }),
    ).toThrow(/AIRWALLEX_CLIENT_ID/);
  });
});

describe("redact", () => {
  it("hides tokens and client secrets nested in a payload", () => {
    expect(redact({ token: "abc", nested: { client_secret: "sec", id: "int_1" } })).toEqual({
      token: "[redacted]",
      nested: { client_secret: "[redacted]", id: "int_1" },
    });
  });
});

describe("payment and split bodies", () => {
  it("creates a collect-directly PaymentIntent without funds_split_data", () => {
    const body = buildPaymentIntentBody({
      amountMinor: 10_000,
      currency: "USD",
      merchantOrderId: "spike-card",
      requestId: "pi:spike-card:1",
      connectedAccountId: "acct_seller",
      metadata: { offerId: "spike-card" },
    });
    expect(body.amount).toBe(100);
    expect(body.connected_account_id).toBe("acct_seller");
    expect(body).not.toHaveProperty("funds_split_data");
  });

  it("omits connected_account_id when the sandbox cannot tag the seller", () => {
    const body = buildPaymentIntentBody({
      amountMinor: 10_000,
      currency: "USD",
      merchantOrderId: "spike-pay",
      requestId: "pi:spike-pay:1",
    });
    expect(body).not.toHaveProperty("connected_account_id");
    expect(body.amount).toBe(100);
  });

  it("creates a held funds split amount as a decimal string", () => {
    const body = buildFundsSplitBody({
      amountMinor: 9_000,
      currency: "USD",
      destination: "acct_seller",
      sourceId: "int_1",
      requestId: "fs:spike-card:seller",
      autoRelease: false,
    });
    expect(body.amount).toBe("90.00");
    expect(body.auto_release).toBe(false);
    expect(body.source_type).toBe("PAYMENT_INTENT");
  });
});
