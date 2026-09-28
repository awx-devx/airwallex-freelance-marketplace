import { route } from "@/server/http";
import { walletFor } from "@/services/wallet";

export const runtime = "nodejs";

export const GET = route({}, async ({ user }) => walletFor(user));
