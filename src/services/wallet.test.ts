import { describe, expect, it } from "vitest";
import { mapBalanceHistory, mapBalances } from "@/services/wallet";

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

describe("mapBalanceHistory", () => {
  it("maps signed history and hides holds", () => {
    const page = mapBalanceHistory(
      {
        has_more: true,
        page_after: "cursor-2",
        items: [
          {
            id: "txn_credit",
            amount: 50,
            currency: "USD",
            posted_at: "2017-04-01T03:52:34+0000",
            transaction_type: "DC_CREDIT",
            description: "Welcome credit",
            source: "tr_1",
          },
          { id: "txn_split", amount: 90, currency: "USD", posted_at: "2017-04-02T00:00:00Z", transaction_type: "SPLIT" },
          { id: "txn_payout", amount: 10, currency: "USD", posted_at: "2017-04-03T00:00:00Z", transaction_type: "PAYOUT" },
          { id: "txn_hold", amount: 5, currency: "USD", posted_at: "2017-04-04T00:00:00Z", transaction_type: "HOLD" },
        ],
      },
      "USD",
    );
    expect(page.nextCursor).toBe("cursor-2");
    expect(page.items.map((item) => [item.type, item.amount.amountMinor, item.label])).toEqual([
      ["DEPOSIT", 5_000, "Welcome credit"],
      ["SPLIT", 9_000, "Funds released"],
      ["PAYOUT", -1_000, "Payout"],
    ]);
    expect(page.items[0]?.at).toBe("2017-04-01T03:52:34.000Z");
    expect(page.items[0]?.airwallexType).toBe("DC_CREDIT");
    expect(page.items[0]?.reference).toBe("tr_1");
  });
});
