import { RequestChangesInputSchema } from "@/contracts/offers";
import { route } from "@/server/http";
import { requestChanges } from "@/services/offers";

export const runtime = "nodejs";

export const POST = route({ body: RequestChangesInputSchema }, async ({ user, params, body }) =>
  requestChanges(user, params.id ?? "", params.mid ?? "", body),
);
