import { describe, expect, it } from "vitest";
import { refundDescription } from "@/components/domain/refund-copy";

describe("refundDescription", () => {
  it("tells the buyer the refund returns to their card or wallet", () => {
    expect(refundDescription({ viewerRole: "BUYER", fundingRail: "CARD", buyerName: "Hannah Lee", amount: "$400.00" })).toBe(
      "$400.00 will be refunded to your card.",
    );
    expect(refundDescription({ viewerRole: "BUYER", fundingRail: "WALLET", buyerName: "Hannah Lee" })).toBe(
      "Milestones that haven't been released will be refunded to your wallet.",
    );
  });

  it("tells the seller the refund returns to the buyer", () => {
    expect(refundDescription({ viewerRole: "SELLER", fundingRail: "CARD", buyerName: "Hannah Lee", amount: "$400.00" })).toBe(
      "$400.00 will be refunded to Hannah Lee's card.",
    );
    expect(refundDescription({ viewerRole: "SELLER", fundingRail: "WALLET", buyerName: "Hannah Lee" })).toBe(
      "Milestones that haven't been released will be refunded to Hannah Lee's wallet.",
    );
  });

  it("omits the rail when the offer has not recorded one", () => {
    expect(refundDescription({ viewerRole: "BUYER", buyerName: "Hannah Lee", amount: "$400.00" })).toBe("$400.00 will be refunded to you.");
    expect(refundDescription({ viewerRole: "SELLER", buyerName: "Hannah Lee" })).toBe(
      "Milestones that haven't been released will be refunded to Hannah Lee.",
    );
  });
});