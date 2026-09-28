import { SignupInputSchema } from "@/contracts/users";
import { setSessionCookie } from "@/lib/session";
import { publicRoute } from "@/server/http";
import { signup } from "@/services/auth";

export const runtime = "nodejs";

export const POST = publicRoute({ body: SignupInputSchema, successStatus: 201 }, async ({ body }) => {
  const me = await signup(body);
  await setSessionCookie({ userId: me.id, guest: false });
  return me;
});
