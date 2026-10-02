import { CancelReasonInputSchema } from "@/contracts/offers";
import { route } from "@/server/http";
import { refundMilestone } from "@/services/release";

export const runtime = "nodejs";

export const POST = route({ body: CancelReasonInputSchema }, async ({ user, params, body }) =>
  refundMilestone(user, params.id ?? "", params.mid ?? "", body),
);
