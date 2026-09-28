import { describe, expect, it } from "vitest";
import { isPublicPath, loginRedirect, mocksEnabledFromEnv } from "@/lib/authGate";

describe("loginRedirect", () => {
  it("skips the cookie check while mocks are on", () => {
    expect(loginRedirect({ mocksEnabled: true, pathname: "/", hasSessionCookie: false })).toBeNull();
  });

  it("sends a real-mode visitor without a cookie to login", () => {
    expect(loginRedirect({ mocksEnabled: false, pathname: "/offers/new", hasSessionCookie: false })).toBe("/login");
    expect(loginRedirect({ mocksEnabled: false, pathname: "/", hasSessionCookie: true })).toBeNull();
  });

  it("leaves public pages alone", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/dev/ui-kit")).toBe(true);
    expect(loginRedirect({ mocksEnabled: false, pathname: "/signup", hasSessionCookie: false })).toBeNull();
  });
});

describe("mocksEnabledFromEnv", () => {
  it("matches the public config default", () => {
    expect(mocksEnabledFromEnv({ NODE_ENV: "development" })).toBe(true);
    expect(mocksEnabledFromEnv({ NODE_ENV: "production", NEXT_PUBLIC_API_MOCKS: "false" })).toBe(false);
    expect(mocksEnabledFromEnv({ NODE_ENV: "development", NEXT_PUBLIC_API_MOCKS: "false" })).toBe(false);
  });
});
