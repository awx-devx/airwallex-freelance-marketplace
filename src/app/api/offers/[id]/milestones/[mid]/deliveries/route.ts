import { SubmitDeliveryInputSchema } from "@/contracts/offers";
import { route } from "@/server/http";
import { submitDelivery } from "@/services/offers";

export const runtime = "nodejs";

export const POST = route({ body: SubmitDeliveryInputSchema }, async ({ user, params, body }) =>
  submitDelivery(user, params.id ?? "", params.mid ?? "", body),
);
