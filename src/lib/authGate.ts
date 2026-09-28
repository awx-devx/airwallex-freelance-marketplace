import { parsePublicConfig, type PublicEnvInput } from "@/lib/config.public";

export function mocksEnabledFromEnv(env: PublicEnvInput & { NODE_ENV?: string }): boolean {
  return parsePublicConfig(env, { nodeEnv: env.NODE_ENV }).apiMocks;
}

export function isPublicPath(pathname: string): boolean {
  return pathname === "/login" || pathname === "/signup" || pathname.startsWith("/dev");
}

/** Where to send a browser that has no session cookie. Null means let the request through. */
export function loginRedirect(input: {
  mocksEnabled: boolean;
  pathname: string;
  hasSessionCookie: boolean;
}): "/login" | null {
  if (input.mocksEnabled || input.hasSessionCookie || isPublicPath(input.pathname)) return null;
  return "/login";
}
