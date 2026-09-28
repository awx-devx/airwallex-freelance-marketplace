import { describe, expect, it } from "vitest";
import { SEED_USERS } from "./users";
import { SEED_OFFERS } from "./offers";

describe("seed offers", () => {
  it("covers the nine demo contracts with unique keys and known people", () => {
    const emails = new Set(SEED_USERS.map((user) => user.email));
    const keys = SEED_OFFERS.map((offer) => offer.seedKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual(["coffee", "landing", "blog", "social", "shopify", "trailer", "pixel", "copy", "icon"]);
    for (const offer of SEED_OFFERS) {
      expect(emails.has(offer.sellerEmail)).toBe(true);
      expect(emails.has(offer.buyerEmail)).toBe(true);
      expect(offer.milestones.length).toBeGreaterThan(0);
      for (const milestone of offer.milestones) {
        expect(milestone.amount).toMatch(/^\d+\.\d{2}$/);
      }
    }
    expect(SEED_OFFERS.find((offer) => offer.seedKey === "coffee")?.milestones.map((item) => item.amount)).toEqual([
      "300.00",
      "700.00",
      "500.00",
    ]);
    expect(SEED_OFFERS.filter((offer) => offer.milestones.some((item) => item.links || item.then)).map((offer) => offer.seedKey)).toEqual([
      "social",
      "shopify",
      "trailer",
      "copy",
      "icon",
    ]);
  });
});
