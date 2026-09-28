import { route } from "@/server/http";
import { listWebhookEvents } from "@/services/platform";

export const runtime = "nodejs";

export const GET = route({}, async () => listWebhookEvents());
