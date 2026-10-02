import { PlatformOverviewSchema, WebhookEventRowSchema, type PlatformOverviewDTO, type WebhookEventRowDTO } from "@/contracts/platform";
import { cardReleaseAccepted } from "@/contracts/permissions";
import { currentBalances } from "@/lib/airwallex/wallet";
import { getServerConfig } from "@/lib/config";
import { connectDb } from "@/lib/db";
import { Offer } from "@/models/offer";
import { PlatformSettings } from "@/models/platformSettings";
import { WebhookEvent } from "@/models/webhookEvent";
import { InvalidState } from "@/server/errors";
import { mapBalances } from "@/services/wallet";

const STUCK_AFTER_MS = 2 * 60 * 1000;

export type BalanceReader = (onBehalfOf?: string) => Promise<unknown>;

function money(amountMinor: number, currency: string) {
  return { amountMinor, currency };
}

function releaseSettling(milestone: {
  status: string;
  lastError?: string;
  release?: {
    sellerSplit?: { status: string };
    revenueSplit?: { status: string };
  };
}): boolean {
  if (milestone.status !== "RELEASING" || milestone.lastError) return false;
  const releaseLegs = [];
  if (milestone.release?.sellerSplit) {
    releaseLegs.push({ kind: "FUNDS_SPLIT", share: "SELLER", status: milestone.release.sellerSplit.status });
  }
  if (milestone.release?.revenueSplit) {
    releaseLegs.push({ kind: "FUNDS_SPLIT", share: "REVENUE", status: milestone.release.revenueSplit.status });
  }
  return cardReleaseAccepted({ status: "RELEASING", releaseLegs });
}

/**
 * DEMO-ONLY: Signed-in users can read this once they pass `DEMO_ADMIN_KEY` (open to everyone when that key is unset).
 * PROD: Restrict this to an admin role and write an audit log for each view.
 */
export async function platformOverview(reader: BalanceReader = currentBalances): Promise<PlatformOverviewDTO> {
  await connectDb();
  const settings = await PlatformSettings.findById("default");
  if (!settings?.revenueAccountId) throw new InvalidState("Run npm run seed so the fee account exists.");

  const currency = getServerConfig().currency;
  const [platformRaw, revenueRaw] = await Promise.all([reader(), reader(settings.revenueAccountId)]);
  const offers = await Offer.find();
  const offerCounts: Record<string, number> = {};
  const milestoneCounts: Record<string, number> = {};
  let fees = 0;
  const stuck: PlatformOverviewDTO["stuck"] = [];
  const cutoff = Date.now() - STUCK_AFTER_MS;

  for (const offer of offers) {
    offerCounts[offer.status] = (offerCounts[offer.status] ?? 0) + 1;
    for (const milestone of offer.milestones) {
      milestoneCounts[milestone.status] = (milestoneCounts[milestone.status] ?? 0) + 1;
      if (milestone.status === "PAID") fees += milestone.breakdown.revenueMinor;
      if (milestone.status !== "RELEASING" && milestone.status !== "REFUNDING") continue;
      if (releaseSettling(milestone)) continue;
      const since = milestone.status === "RELEASING" ? (milestone.approvedAt ?? offer.updatedAt) : offer.updatedAt;
      if (since.getTime() > cutoff) continue;
      stuck.push({
        offerId: offer._id.toString(),
        offerTitle: offer.title,
        milestoneId: milestone._id.toString(),
        milestoneTitle: milestone.title,
        status: milestone.status,
        since: since.toISOString(),
      });
    }
  }

  return PlatformOverviewSchema.parse({
    platformBalances: mapBalances(platformRaw, currency),
    revenueAccount: {
      accountId: settings.revenueAccountId,
      balances: mapBalances(revenueRaw, currency),
    },
    feesCollected: money(fees, currency),
    counts: { offers: offerCounts, milestones: milestoneCounts },
    stuck,
  });
}

export async function listWebhookEvents(): Promise<WebhookEventRowDTO[]> {
  await connectDb();
  const rows = await WebhookEvent.find().sort({ receivedAt: -1 }).limit(50);
  return rows.map((row) =>
    WebhookEventRowSchema.parse({
      id: row.eventId,
      name: row.name,
      objectId: row.objectId,
      receivedAt: row.receivedAt.toISOString(),
      processed: Boolean(row.processedAt),
      processingError: row.processingError,
    }),
  );
}
