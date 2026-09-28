import { route } from "@/server/http";
import { reconcileCardPayment } from "@/services/funding";

export const runtime = "nodejs";

export const POST = route({}, async ({ user, params }) => reconcileCardPayment(user, params.id ?? ""));
