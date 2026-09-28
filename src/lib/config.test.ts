import { describe, expect, it } from "vitest";
import { parseServerConfig } from "@/lib/config";

const secret = "s".repeat(32);

function env(overrides: Record<string, string | undefined> = {}) {
  return {
    MONGODB_URI: "mongodb://localhost:27017/awx-escrow",
    SESSION_SECRET: secret,
    ...overrides,
  };
}

describe("parseServerConfig", () => {
  it("applies demo defaults", () => {
    const config = parseServerConfig(env());
    expect(config).toMatchObject({
      appUrl: "http://localhost:3000",
      currency: "USD",
      platformFeePercent: 10,
      processingReservePercent: 2,
      welcomeCreditAmount: 5000,
      walletRailEnabled: true,
      sequentialMilestones: false,
      seedPassword: "demo1234",
    });
  });

  it("strips a trailing slash from APP_URL", () => {
    expect(parseServerConfig(env({ APP_URL: "http://localhost:3000/" })).appUrl).toBe("http://localhost:3000");
  });

  it("rejects a short session secret and a reserve above the fee", () => {
    expect(() => parseServerConfig(env({ SESSION_SECRET: "short" }))).toThrow(/SESSION_SECRET/);
    expect(() => parseServerConfig(env({ PLATFORM_FEE_PERCENT: "10", PROCESSING_RESERVE_PERCENT: "11" }))).toThrow(
      /PROCESSING_RESERVE_PERCENT/,
    );
  });

  it("requires a database URI", () => {
    expect(() => parseServerConfig(env({ MONGODB_URI: "  " }))).toThrow(/MONGODB_URI/);
  });
});
