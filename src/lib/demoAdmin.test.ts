import { describe, expect, it } from "vitest";
import { demoAdminCookieMatches, demoAdminSecretMatches, demoAdminToken } from "@/lib/demoAdmin";

describe("demo admin key", () => {
  it("accepts an exact key and rejects a different one", () => {
    expect(demoAdminSecretMatches("correct-horse", "correct-horse")).toBe(true);
    expect(demoAdminSecretMatches("correct-horse", "correct-horses")).toBe(false);
    expect(demoAdminSecretMatches("", "correct-horse")).toBe(false);
  });

  it("accepts only the token derived from the configured key", () => {
    const key = "admin-key";
    expect(demoAdminCookieMatches(demoAdminToken(key), key)).toBe(true);
    expect(demoAdminCookieMatches(demoAdminToken("other"), key)).toBe(false);
    expect(demoAdminCookieMatches(undefined, key)).toBe(false);
    expect(demoAdminCookieMatches(key, key)).toBe(false);
  });
});
