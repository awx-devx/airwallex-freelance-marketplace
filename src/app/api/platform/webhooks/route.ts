import { assertDemoAdmin } from "@/lib/demoAdmin";
import { route } from "@/server/http";
import { listWebhookEvents } from "@/services/platform";

export const runtime = "nodejs";

export const GET = route({}, async () => {
  await assertDemoAdmin();
  return listWebhookEvents();
});
