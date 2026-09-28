import { setSessionCookie } from "@/lib/session";
import { publicRoute } from "@/server/http";
import { guestLogin } from "@/services/auth";

export const runtime = "nodejs";

export const POST = publicRoute({}, async () => {
  const me = await guestLogin();
  await setSessionCookie({ userId: me.id, guest: true });
  return me;
});
