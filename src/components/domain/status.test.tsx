import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MilestoneStatusSchema, OfferStatusSchema } from "@/contracts/offers";
import { Money } from "@/components/domain/money";
import { statusVisual } from "@/components/domain/status";

describe("status visuals", () => {
  it("labels every offer and milestone status", () => {
    for (const status of [...OfferStatusSchema.options, ...MilestoneStatusSchema.options]) {
      expect(statusVisual(status).label.length).toBeGreaterThan(0);
    }
  });
});

describe("Money", () => {
  it("formats a positive amount", () => {
    render(<Money value={{ amountMinor: 125000, currency: "USD" }} />);
    expect(screen.getByText("$1,250.00").textContent).toBe("$1,250.00");
  });
});
