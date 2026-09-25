import { describe, expect, it } from "vitest";
import { fromAwxAmount, formatMoney, toAwxAmount } from "@/lib/money";

describe("toAwxAmount", () => {
  it("converts minor units to decimal major units", () => {
    expect(toAwxAmount(1250, "USD")).toBe(12.5);
    expect(toAwxAmount(10, "USD")).toBe(0.1);
    expect(toAwxAmount(100_000, "USD")).toBe(1000);
    expect(toAwxAmount(-1250, "USD")).toBe(-12.5);
  });

  it("rejects a non-integer and an unknown currency", () => {
    expect(() => toAwxAmount(12.5, "USD")).toThrow(/integer/);
    expect(() => toAwxAmount(100, "JPY")).toThrow(/Unsupported currency/);
  });
});

describe("fromAwxAmount", () => {
  it("parses decimal strings and numbers into minor units", () => {
    expect(fromAwxAmount("12.50", "USD")).toBe(1250);
    expect(fromAwxAmount("450", "USD")).toBe(45_000);
    expect(fromAwxAmount(12.5, "USD")).toBe(1250);
    expect(fromAwxAmount("12.505", "USD")).toBe(1251);
    expect(fromAwxAmount("-12.50", "USD")).toBe(-1250);
  });

  it("round-trips through toAwxAmount", () => {
    expect(fromAwxAmount(toAwxAmount(33333, "USD"), "USD")).toBe(33333);
  });
});

describe("formatMoney", () => {
  it("formats USD with a dollar sign and two decimals", () => {
    expect(formatMoney(125_000, "USD")).toBe("$1,250.00");
    expect(formatMoney(0, "USD")).toBe("$0.00");
    expect(formatMoney(-1250, "USD")).toBe("-$12.50");
  });
});
