import { describe, expect, it } from "vitest";
import { initialsFromName, toMe } from "@/server/dto/users";
import { toPublicConfig } from "@/server/dto/publicConfig";
import { parseServerConfig } from "@/lib/config";

describe("user DTOs", () => {
  it("builds initials from the first two words", () => {
    expect(initialsFromName("Maya Chen")).toBe("MC");
    expect(initialsFromName("Sam")).toBe("S");
  });

  it("maps lastError onto the provisioning error field", () => {
    const me = toMe(
      {
        _id: { toString: () => "abc" },
        email: "maya@demo.test",
        name: "Maya Chen",
        headline: "Designer",
        avatarColor: "#7C3AED",
        kind: "REGULAR",
        airwallex: {
          accountId: "acct_123",
          accountStatus: "ACTIVE",
          provisioning: { step: "FAILED", failedStep: "SUBMITTED", lastError: "submit failed", updatedAt: new Date() },
        },
      },
      false,
    );
    expect(me.provisioning).toEqual({ step: "FAILED", failedStep: "SUBMITTED", error: "submit failed" });
    expect(me.isGuest).toBe(false);
    expect(me.initials).toBe("MC");
  });
});

describe("toPublicConfig", () => {
  it("matches the public contract", () => {
    const dto = toPublicConfig(parseServerConfig({ MONGODB_URI: "mongodb://localhost/awx", SESSION_SECRET: "s".repeat(32) }), {
      airwallexEnv: "demo",
      apiMocks: false,
    });
    expect(dto.mocksEnabled).toBe(false);
    expect(dto.minMilestoneMinor).toBe(1_000);
    expect(dto.maxOfferTotalMinor).toBe(900_000);
    expect(dto.testCards.map((card) => card.outcome)).toEqual(["success", "decline"]);
  });
});
