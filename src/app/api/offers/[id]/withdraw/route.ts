import { route } from "@/server/http";
import { withdrawOffer } from "@/services/offers";

export const runtime = "nodejs";

export const POST = route({}, async ({ user, params }) => withdrawOffer(user, params.id ?? ""));
