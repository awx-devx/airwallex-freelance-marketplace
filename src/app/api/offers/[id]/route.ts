import { route } from "@/server/http";
import { getOffer } from "@/services/offers";

export const runtime = "nodejs";

export const GET = route({}, async ({ user, params }) => getOffer(user, params.id ?? ""));
