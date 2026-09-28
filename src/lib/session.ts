import { cookies } from "next/headers";
import { getServerConfig } from "@/lib/config";
import { SESSION_COOKIE, signSessionToken, verifySessionToken, type SessionClaims } from "@/lib/sessionToken";

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  };
}

export async function readSession(): Promise<SessionClaims | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    return await verifySessionToken(token, getServerConfig().sessionSecret);
  } catch {
    return null;
  }
}

export async function setSessionCookie(claims: SessionClaims): Promise<void> {
  const token = await signSessionToken(claims, getServerConfig().sessionSecret);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, cookieOptions());
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}
