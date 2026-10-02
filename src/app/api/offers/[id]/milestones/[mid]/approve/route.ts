import { route } from "@/server/http";
import { approveMilestone } from "@/services/release";

export const runtime = "nodejs";

export const POST = route({}, async ({ user, params }) => approveMilestone(user, params.id ?? "", params.mid ?? ""));
