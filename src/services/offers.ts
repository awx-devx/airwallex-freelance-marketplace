import { randomBytes } from "node:crypto";
import { fromAwxAmount } from "@/lib/money";
import { getServerConfig } from "@/lib/config";
import { connectDb } from "@/lib/db";
import { Activity } from "@/models/activity";
import { Offer } from "@/models/offer";
import { User } from "@/models/user";
import { WELCOME_TEMPLATES } from "../../scripts/seed-data/welcome-templates";
import { breakdown } from "@/services/fees";

const SHORT_REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function shortRef(): string {
  const bytes = randomBytes(4);
  let code = "";
  for (const byte of bytes) code += SHORT_REF_ALPHABET[byte % SHORT_REF_ALPHABET.length];
  return `OF-${code}`;
}

/**
 * One SENT offer from a ready seed seller. No-op when this buyer already has one.
 * DEMO-ONLY: A random seed seller's offer appears so a new signup has something to accept.
 * PROD: No generated offers. Buyers only see offers a seller actually sent.
 */
export async function createWelcomeOffer(buyerId: string): Promise<void> {
  await connectDb();
  const existing = await Offer.findOne({ buyerId, isWelcomeOffer: true });
  if (existing) return;

  const sellers = await User.find({
    _id: { $ne: buyerId },
    kind: "SEED",
    demoRole: { $in: ["Seller", "Both"] },
    "airwallex.provisioning.step": "READY",
  });
  const seller = sellers[Math.floor(Math.random() * sellers.length)];
  if (!seller) {
    throw new Error("No demo seller is ready yet. Run npm run seed, then retry.");
  }

  const template = WELCOME_TEMPLATES[Math.floor(Math.random() * WELCOME_TEMPLATES.length)];
  if (!template) throw new Error("No welcome offer templates are configured.");

  const config = getServerConfig();
  const fee = {
    platformFeePercent: config.platformFeePercent,
    processingReservePercent: config.processingReservePercent,
  };
  const milestones = template.milestones.map((milestone, index) => {
    const amountMinor = fromAwxAmount(milestone.amount, config.currency);
    const parts = breakdown(amountMinor, fee);
    return {
      index,
      title: milestone.title,
      amountMinor,
      breakdown: { sellerMinor: parts.sellerMinor, revenueMinor: parts.revenueMinor, reserveMinor: parts.reserveMinor },
      status: "PENDING_FUNDING" as const,
      deliveries: [],
    };
  });
  const totalMinor = milestones.reduce((sum, milestone) => sum + milestone.amountMinor, 0);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const created = await Offer.create({
        shortRef: shortRef(),
        sellerId: seller._id,
        buyerId,
        title: template.title,
        description: template.description,
        currency: config.currency,
        totalMinor,
        status: "SENT",
        feeSnapshot: fee,
        isWelcomeOffer: true,
        milestones,
        sentAt: new Date(),
      });
      await Activity.create({
        offerId: created._id,
        actorId: seller._id,
        type: "OFFER_SENT",
        message: `${seller.name} sent a welcome offer.`,
      });
      return;
    } catch (error) {
      const duplicate = typeof error === "object" && error !== null && "code" in error && (error as { code: unknown }).code === 11000;
      if (!duplicate || attempt === 4) throw error;
    }
  }
}
