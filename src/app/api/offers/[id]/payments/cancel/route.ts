import { route } from "@/server/http";
import { cancelCardPayment } from "@/services/funding";

export const runtime = "nodejs";

export const POST = route({}, async ({ user, params }) => cancelCardPayment(user, params.id ?? ""));
