import { route } from "@/server/http";
import { listAirwallexEvents } from "@/services/airwallexEvents";

export const runtime = "nodejs";

export const GET = route({}, async ({ user, params }) => listAirwallexEvents(user, params.id ?? ""));
