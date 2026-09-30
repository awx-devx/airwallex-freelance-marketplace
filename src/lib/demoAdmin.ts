import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getServerConfig } from "@/lib/config";
import { publicConfig } from "@/lib/config.public";
import { Forbidden } from "@/server/errors";

export const DEMO_ADMIN_COOKIE = "demo_admin";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 12;

function digest(value: string): Buffer {
  return createHmac("sha256", "demo-admin").update(value).digest();
}

/** Compare two secrets without leaking which one is longer. */
export function demoAdminSecretMatches(submitted: string, expected: string): boolean {
  return timingSafeEqual(digest(submitted), digest(expected));
}

export function demoAdminToken(key: string): string {
  return createHmac("sha256", key).update("demo-admin").digest("base64url");
}

export function demoAdminCookieMatches(cookie: string | undefined, key: string): boolean {
  if (!cookie) return false;
  return demoAdminSecretMatches(cookie, demoAdminToken(key));
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  };
}

/**
 * DEMO-ONLY: When `DEMO_ADMIN_KEY` is unset, any signed-in user may open `/platform`.
 * PROD: Admin role checks and an audit log. Mock mode skips the cookie because the page shows fixture balances.
 */
export async function demoAdminUnlocked(): Promise<boolean> {
  const key = getServerConfig().demoAdminKey;
  if (!key || publicConfig.apiMocks) return true;
  const jar = await cookies();
  return demoAdminCookieMatches(jar.get(DEMO_ADMIN_COOKIE)?.value, key);
}

export async function assertDemoAdmin(): Promise<void> {
  if (await demoAdminUnlocked()) return;
  throw new Forbidden("Enter the demo admin key to view the platform.");
}

export async function grantDemoAdmin(submitted: string): Promise<void> {
  const key = getServerConfig().demoAdminKey;
  if (!key) return;
  if (!demoAdminSecretMatches(submitted, key)) throw new Forbidden("That key is incorrect.");
  const jar = await cookies();
  jar.set(DEMO_ADMIN_COOKIE, demoAdminToken(key), cookieOptions());
}
