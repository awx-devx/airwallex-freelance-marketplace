import { route } from "@/server/http";
import { platformOverview } from "@/services/platform";

export const runtime = "nodejs";

export const GET = route({}, async () => platformOverview());
