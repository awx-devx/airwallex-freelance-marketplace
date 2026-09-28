import { TransactionsQuerySchema } from "@/contracts/wallet";
import { route } from "@/server/http";
import { transactionsFor } from "@/services/wallet";

export const runtime = "nodejs";

export const GET = route({ query: TransactionsQuerySchema }, async ({ user, query }) => transactionsFor(user, query.cursor));
