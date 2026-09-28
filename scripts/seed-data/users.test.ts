import { describe, expect, it } from "vitest";
import { REVENUE_USER, SEED_USERS, seedIdentifier } from "./users";

describe("seed users", () => {
  it("matches the eight demo personas and the revenue account", () => {
    expect(REVENUE_USER.email).toBe("revenue@demo.test");
    expect(SEED_USERS.map((user) => user.email)).toEqual([
      "maya@demo.test",
      "leo@demo.test",
      "priya@demo.test",
      "sam@demo.test",
      "hannah@demo.test",
      "diego@demo.test",
      "aiko@demo.test",
      "omar@demo.test",
    ]);
    expect(SEED_USERS.filter((user) => user.role === "Seller").every((user) => user.extraTopUpMajor === 0)).toBe(true);
    expect(SEED_USERS.filter((user) => user.role !== "Seller").every((user) => user.extraTopUpMajor === 20_000)).toBe(true);
    expect(seedIdentifier("maya@demo.test", 1)).toBe("seed-maya");
    expect(seedIdentifier("maya@demo.test", 2)).toBe("seed-maya-v2");
  });
});
