import { route } from "@/server/http";
import { declineOffer } from "@/services/offers";

export const runtime = "nodejs";

export const POST = route({}, async ({ user, params }) => declineOffer(user, params.id ?? ""));
