import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "session";
const SESSION_TTL = "14d";

export type SessionClaims = {
  userId: string;
  guest: boolean;
};

function key(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(claims: SessionClaims, secret: string): Promise<string> {
  return new SignJWT({ guest: claims.guest })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.userId)
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(key(secret));
}

export async function verifySessionToken(token: string, secret: string): Promise<SessionClaims> {
  const { payload } = await jwtVerify(token, key(secret));
  if (!payload.sub || typeof payload.guest !== "boolean") {
    throw new Error("Session token is missing its subject or guest flag.");
  }
  return { userId: payload.sub, guest: payload.guest };
}
