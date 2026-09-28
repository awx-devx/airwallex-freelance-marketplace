import { route } from "@/server/http";
import { createOfferInputSchema, OffersQuerySchema } from "@/contracts/offers";
import { OFFER_RULES, getServerConfig } from "@/lib/config";
import { createAndSend, listOffers } from "@/services/offers";

export const runtime = "nodejs";

export const GET = route({ query: OffersQuerySchema }, async ({ user, query }) => listOffers(user, query.view));

export function POST(request: Request, context?: { params?: Promise<Record<string, string>> }) {
  const config = getServerConfig();
  return route(
    {
      body: createOfferInputSchema({
        currency: config.currency,
        minMilestoneMinor: OFFER_RULES.minMilestoneMinor,
        maxOfferTotalMinor: OFFER_RULES.maxOfferTotalMinor,
        maxMilestones: OFFER_RULES.maxMilestones,
      }),
      successStatus: 201,
    },
    async ({ user, body }) => createAndSend(user, body),
  )(request, context);
}
