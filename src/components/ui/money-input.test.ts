import { describe, expect, it } from "vitest";
import { formatMoneyPreview, moneyInputError } from "./money-input";

describe("formatMoneyPreview", () => {
  it("formats a valid amount", () => {
    expect(formatMoneyPreview("450.00")).toBe("$450.00");
    expect(formatMoneyPreview("450")).toBe("$450.00");
  });

  it("returns null for an invalid amount", () => {
    expect(formatMoneyPreview("4.5.0")).toBeNull();
    expect(formatMoneyPreview("")).toBeNull();
  });
});

describe("moneyInputError", () => {
  it("allows an empty value", () => {
    expect(moneyInputError("")).toBeNull();
  });

  it("rejects a malformed amount and a value below the minimum", () => {
    expect(moneyInputError("4.5.0")).toMatch(/2 decimal/);
    expect(moneyInputError("4.00")).toMatch(/Minimum is \$10.00/);
    expect(moneyInputError("10")).toBeNull();
  });
});
