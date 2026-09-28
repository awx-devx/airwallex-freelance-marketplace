import { SendFundsInputSchema } from "@/contracts/wallet";
import { route } from "@/server/http";
import { sendFunds } from "@/services/walletMovements";

export const runtime = "nodejs";

export const POST = route({ body: SendFundsInputSchema }, async ({ user, body }) => sendFunds(user, body));
