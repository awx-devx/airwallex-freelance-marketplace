import { route } from "@/server/http";
import { startCardPayment } from "@/services/funding";

export const runtime = "nodejs";

export const POST = route({}, async ({ user, params }) => startCardPayment(user, params.id ?? ""));
