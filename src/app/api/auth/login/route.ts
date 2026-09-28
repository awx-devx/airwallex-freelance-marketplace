import { LoginInputSchema } from "@/contracts/users";
import { setSessionCookie } from "@/lib/session";
import { publicRoute } from "@/server/http";
import { login } from "@/services/auth";

export const runtime = "nodejs";

export const POST = publicRoute({ body: LoginInputSchema }, async ({ body }) => {
  const me = await login(body);
  await setSessionCookie({ userId: me.id, guest: false });
  return me;
});
