import { describe, expect, it } from "vitest";
import { mapBalances } from "@/services/wallet";

describe("mapBalances", () => {
  it("keeps the USD cash row and converts major units to minor units", () => {
    const balances = mapBalances(
      [
        { currency: "USD", available_amount: 5000, pending_amount: 10.5, reserved_amount: 0 },
        { currency: "USD", account_type: "issuing", available_amount: 99, pending_amount: 0, reserved_amount: 0 },
        { currency: "EUR", available_amount: 20, pending_amount: 0, reserved_amount: 0 },
      ],
      "USD",
    );
    expect(balances).toEqual([
      {
        currency: "USD",
        available: { amountMinor: 500_000, currency: "USD" },
        pending: { amountMinor: 1_050, currency: "USD" },
        reserved: { amountMinor: 0, currency: "USD" },
        total: { amountMinor: 501_050, currency: "USD" },
      },
    ]);
  });

  it("returns nothing when the payload is not a list", () => {
    expect(mapBalances({ items: [] }, "USD")).toEqual([]);
  });
});
