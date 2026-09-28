import { route } from "@/server/http";
import { listActivity } from "@/services/offers";

export const runtime = "nodejs";

export const GET = route({}, async ({ user, params }) => listActivity(user, params.id ?? ""));
