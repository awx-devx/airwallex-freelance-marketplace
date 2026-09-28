import { route } from "@/server/http";
import { retryMilestone } from "@/services/escrow";

export const runtime = "nodejs";

export const POST = route({}, async ({ user, params }) => retryMilestone(user, params.id ?? "", params.mid ?? ""));
