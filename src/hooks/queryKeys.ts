import type { OffersQuery } from "@/contracts/offers";

export type OfferView = OffersQuery["view"];

export const qk = {
  config: ["config"] as const,
  me: ["me"] as const,
  demoAccounts: ["demo-accounts"] as const,
  userSearch: (q: string) => ["users", "search", q] as const,
  offers: ["offers"] as const,
  offerList: (view: OfferView) => ["offers", "list", view] as const,
  offer: (id: string) => ["offers", "detail", id] as const,
  offerActivity: (id: string) => ["offers", "detail", id, "activity"] as const,
  offerAwxEvents: (id: string) => ["offers", "detail", id, "airwallex-events"] as const,
  wallet: ["wallet"] as const,
  walletTx: ["wallet", "transactions"] as const,
  platform: ["platform"] as const,
  platformWebhooks: ["platform", "webhooks"] as const,
};
