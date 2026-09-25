import { describe, expect, it } from "vitest";
import { assertApiMocksAllowed, parsePublicConfig } from "./config.public";

describe("parsePublicConfig", () => {
  it("defaults to mocks and a hidden UI kit outside production", () => {
    expect(parsePublicConfig({}, { nodeEnv: "development" })).toEqual({
      airwallexEnv: "demo",
      apiMocks: true,
      uiKitEnabled: true,
    });
  });

  it("keeps the UI kit on in development even when the flag is false", () => {
    expect(
      parsePublicConfig({ NEXT_PUBLIC_ENABLE_UI_KIT: "false" }, { nodeEnv: "development" }).uiKitEnabled,
    ).toBe(true);
  });

  it("turns mocks off in production when the flag is unset", () => {
    expect(parsePublicConfig({}, { nodeEnv: "production" }).apiMocks).toBe(false);
  });

  it("rejects values that are not true or false", () => {
    expect(() => parsePublicConfig({ NEXT_PUBLIC_API_MOCKS: "yes" })).toThrow();
  });
});

describe("assertApiMocksAllowed", () => {
  it("refuses mocks in production unless the preview opt-in is set", () => {
    const config = parsePublicConfig({ NEXT_PUBLIC_API_MOCKS: "true" }, { nodeEnv: "production" });

    expect(() => assertApiMocksAllowed(config, { nodeEnv: "production" })).toThrow(/ALLOW_MOCKS_IN_PROD/);
    expect(() =>
      assertApiMocksAllowed(config, { nodeEnv: "production", allowMocksInProd: "true" }),
    ).not.toThrow();
  });
});
