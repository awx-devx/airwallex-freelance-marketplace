import { publicRoute } from "@/server/http";
import { listDemoAccounts } from "@/services/auth";

export const runtime = "nodejs";

export const GET = publicRoute({}, async () => listDemoAccounts());
