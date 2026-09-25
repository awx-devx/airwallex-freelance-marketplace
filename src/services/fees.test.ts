import { describe, expect, it } from "vitest";
import { breakdown } from "@/services/fees";

const defaults = { platformFeePercent: 10, processingReservePercent: 2 };

describe("breakdown", () => {
  it("splits $1,000.00 into seller, revenue, and reserve", () => {
    expect(breakdown(100_000, defaults)).toEqual({
      sellerMinor: 90_000,
      revenueMinor: 8_000,
      reserveMinor: 2_000,
      feeMinor: 10_000,
    });
  });

  it("rounds half up on $333.33", () => {
    const parts = breakdown(33_333, defaults);
    expect(parts).toEqual({
      sellerMinor: 30_000,
      revenueMinor: 2_666,
      reserveMinor: 667,
      feeMinor: 3_333,
    });
    expect(parts.sellerMinor + parts.revenueMinor + parts.reserveMinor).toBe(33_333);
  });

  it("rounds a half cent up", () => {
    expect(breakdown(15, { platformFeePercent: 10, processingReservePercent: 0 })).toEqual({
      sellerMinor: 13,
      revenueMinor: 2,
      reserveMinor: 0,
      feeMinor: 2,
    });
  });

  it("sends the whole fee to revenue when the reserve is zero", () => {
    expect(breakdown(100_000, { platformFeePercent: 10, processingReservePercent: 0 })).toEqual({
      sellerMinor: 90_000,
      revenueMinor: 10_000,
      reserveMinor: 0,
      feeMinor: 10_000,
    });
  });

  it("keeps the three shares equal to the milestone on the $10 minimum", () => {
    const parts = breakdown(1_000, defaults);
    expect(parts.sellerMinor + parts.revenueMinor + parts.reserveMinor).toBe(1_000);
    expect(parts.feeMinor).toBe(parts.revenueMinor + parts.reserveMinor);
    expect(parts.sellerMinor).toBeGreaterThan(0);
  });

  it("rejects a config that would make a share negative", () => {
    expect(() => breakdown(10_000, { platformFeePercent: 1, processingReservePercent: 50 })).toThrow(/negative share/);
  });

  it("rejects a negative amount", () => {
    expect(() => breakdown(-1, defaults)).toThrow(/non-negative/);
  });
});
