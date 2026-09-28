import { CancelReasonInputSchema } from "@/contracts/offers";
import { route } from "@/server/http";
import { cancelRemaining } from "@/services/escrow";

export const runtime = "nodejs";

export const POST = route({ body: CancelReasonInputSchema }, async ({ user, params, body }) =>
  cancelRemaining(user, params.id ?? "", body),
);
