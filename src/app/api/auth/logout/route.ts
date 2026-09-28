import { clearSessionCookie } from "@/lib/session";
import { publicRoute } from "@/server/http";

export const runtime = "nodejs";

export const POST = publicRoute({}, async () => {
  await clearSessionCookie();
  return { ok: true as const };
});
