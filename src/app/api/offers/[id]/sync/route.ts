import { route } from "@/server/http";
import { syncOffer } from "@/services/funding";

export const runtime = "nodejs";

export const POST = route({}, async ({ user, params }) => syncOffer(user, params.id ?? ""));
