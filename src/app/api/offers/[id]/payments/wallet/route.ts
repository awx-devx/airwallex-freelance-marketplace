import { route } from "@/server/http";
import { payFromWallet } from "@/services/funding";

export const runtime = "nodejs";

export const POST = route({}, async ({ user, params }) => payFromWallet(user, params.id ?? ""));
