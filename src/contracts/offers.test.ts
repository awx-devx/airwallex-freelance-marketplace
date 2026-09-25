import { describe, expect, it } from "vitest";
import { CreateOfferInputSchema, OfferSchema, SubmitDeliveryInputSchema } from "@/contracts/offers";

const usd = (amountMinor: number) => ({ amountMinor, currency: "USD" });

const maya = {
  id: "u_maya",
  name: "Maya Chen",
  headline: "Brand & identity designer",
  avatarColor: "#7C3AED",
  initials: "MC",
};

describe("OfferSchema", () => {
  it("parses an active offer", () => {
    const parsed = OfferSchema.parse({
      id: "66f3c0a1e4b0a1b2c3d4e5f6",
      shortRef: "OF-7K2Q",
      title: "Coffee brand identity",
      description: "Full identity for Rivera Coffee Co.",
      status: "ACTIVE",
      viewerRole: "BUYER",
      seller: maya,
      buyer: {
        id: "u_sam",
        name: "Sam Rivera",
        headline: "Founder, Rivera Coffee Co.",
        avatarColor: "#0EA5E9",
        initials: "SR",
      },
      total: usd(150_000),
      released: usd(30_000),
      refunded: usd(0),
      milestoneCount: 2,
      milestoneCounts: { PAID: 1, SUBMITTED: 1 },
      isWelcomeOffer: false,
      sentAt: "2026-09-25T17:00:00.000Z",
      updatedAt: "2026-09-25T17:50:00.000Z",
      fundingRail: "CARD",
      feeSnapshot: { platformFeePercent: 10, processingReservePercent: 2 },
      totals: {
        held: usd(120_000),
        released: usd(30_000),
        refunded: usd(0),
        fees: { seller: usd(135_000), revenue: usd(12_000), reserve: usd(3_000), fee: usd(15_000) },
      },
      milestones: [
        {
          id: "m1",
          index: 0,
          title: "Moodboard",
          amount: usd(30_000),
          breakdown: { seller: usd(27_000), revenue: usd(2_400), reserve: usd(600), fee: usd(3_000) },
          status: "PAID",
          isPending: false,
          deliveries: [],
          escrowLegs: [],
          allowedActions: [],
          paidAt: "2026-09-25T17:42:00.000Z",
        },
      ],
      allowedActions: ["CANCEL_REMAINING"],
      isPending: false,
    });

    expect(parsed.shortRef).toBe("OF-7K2Q");
    expect(parsed.allowedActions).toEqual(["CANCEL_REMAINING"]);
  });
});

describe("CreateOfferInputSchema", () => {
  const valid = {
    buyerId: "u_sam",
    title: "Coffee brand identity",
    description: "Full identity.",
    milestones: [{ title: "Moodboard", amount: "450.00", dueDate: "2026-10-12" }],
  };

  it("accepts a milestone at the minimum", () => {
    expect(CreateOfferInputSchema.parse(valid).milestones[0]?.amount).toBe("450.00");
    expect(CreateOfferInputSchema.parse({ ...valid, milestones: [{ title: "Moodboard", amount: "10" }] }).milestones).toHaveLength(1);
  });

  it("rejects a short title, a bad amount, a milestone under $10, and a total over $9,000", () => {
    expect(CreateOfferInputSchema.safeParse({ ...valid, title: "No" }).success).toBe(false);
    expect(CreateOfferInputSchema.safeParse({ ...valid, milestones: [{ title: "Moodboard", amount: "4.5.0" }] }).success).toBe(false);
    const below = CreateOfferInputSchema.safeParse({ ...valid, milestones: [{ title: "Moodboard", amount: "4.00" }] });
    expect(below.success).toBe(false);
    if (!below.success) {
      expect(below.error.issues.some((issue) => issue.message.includes("$10.00"))).toBe(true);
    }
    const over = CreateOfferInputSchema.safeParse({
      ...valid,
      milestones: [
        { title: "One", amount: "5000.00" },
        { title: "Two", amount: "4000.01" },
      ],
    });
    expect(over.success).toBe(false);
  });
});

describe("SubmitDeliveryInputSchema", () => {
  it("requires one to five http(s) links", () => {
    expect(SubmitDeliveryInputSchema.safeParse({ links: ["https://www.figma.com/file/demo-logo"] }).success).toBe(true);
    expect(SubmitDeliveryInputSchema.safeParse({ links: [] }).success).toBe(false);
    expect(SubmitDeliveryInputSchema.safeParse({ links: ["ftp://files.example/logo"] }).success).toBe(false);
  });
});
