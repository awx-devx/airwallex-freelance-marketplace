import { WithdrawalInputSchema } from "@/contracts/wallet";
import { route } from "@/server/http";
import { withdrawToBank } from "@/services/walletMovements";

export const runtime = "nodejs";

export const POST = route({ body: WithdrawalInputSchema }, async ({ user, body }) => withdrawToBank(user, body));
