import type { PublicConfigDTO } from "@/contracts/users";
import { PublicConfigSchema } from "@/contracts/users";
import { OFFER_RULES, type ServerConfig } from "@/lib/config";
import type { PublicConfig } from "@/lib/config.public";

// SANDBOX: Airwallex test cards shown on the pay page.
// https://www.airwallex.com/docs/payments/test-and-go-live/test-card-numbers.md
const SANDBOX_TEST_CARDS = [
  { number: "4035501000000008", label: "Success", outcome: "success" as const },
  { number: "4012000300001003", label: "Decline", outcome: "decline" as const },
];

export function toPublicConfig(server: ServerConfig, pub: Pick<PublicConfig, "airwallexEnv" | "apiMocks">): PublicConfigDTO {
  return PublicConfigSchema.parse({
    currency: server.currency,
    platformFeePercent: server.platformFeePercent,
    processingReservePercent: server.processingReservePercent,
    minMilestoneMinor: OFFER_RULES.minMilestoneMinor,
    maxOfferTotalMinor: OFFER_RULES.maxOfferTotalMinor,
    maxMilestones: OFFER_RULES.maxMilestones,
    walletRailEnabled: server.walletRailEnabled,
    airwallexEnv: pub.airwallexEnv,
    testCards: SANDBOX_TEST_CARDS,
    mocksEnabled: pub.apiMocks,
  });
}
