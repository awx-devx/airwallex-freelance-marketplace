import { OkSchema } from "@/contracts/common";
import { DemoAdminUnlockSchema } from "@/contracts/platform";
import { grantDemoAdmin } from "@/lib/demoAdmin";
import { route } from "@/server/http";

export const runtime = "nodejs";

export const POST = route({ body: DemoAdminUnlockSchema }, async ({ body }) => {
  await grantDemoAdmin(body.key);
  return OkSchema.parse({ ok: true });
});
