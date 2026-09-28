import { readString, type JsonObject } from "@/lib/airwallex/json";
import { createFundsSplit, retrieveFundsSplit, type CreateFundsSplitInput } from "@/lib/airwallex/fundsSplits";
import { sellerSplitRequestId, revenueSplitRequestId } from "@/lib/airwallex/requestIds";
import { connectDb } from "@/lib/db";
import { Activity } from "@/models/activity";
import { Offer } from "@/models/offer";
import { Payment } from "@/models/payment";
import { PlatformSettings } from "@/models/platformSettings";
import { User } from "@/models/user";

const SPLIT_RANK: Record<string, number> = { CREATED: 1, RELEASED: 2, SETTLED: 3 };
const SPLIT_STATUSES = new Set(["CREATED", "RELEASED", "SETTLED", "FAILED"]);

export type SplitGateway = {
  createFundsSplit: (input: CreateFundsSplitInput) => Promise<JsonObject>;
  retrieveFundsSplit: (splitId: string) => Promise<JsonObject>;
};

const liveSplits: SplitGateway = { createFundsSplit, retrieveFundsSplit };

export function canAdvanceSplit(current: string, next: string): boolean {
  if (!SPLIT_STATUSES.has(next) || current === next) return false;
  if (next === "FAILED") return current === "CREATED" || current === "RELEASED";
  return (SPLIT_RANK[next] ?? 0) > (SPLIT_RANK[current] ?? 0);
}

function knownSplitStatus(value: string | undefined): "CREATED" | "RELEASED" | "SETTLED" | "FAILED" | undefined {
  if (value && SPLIT_STATUSES.has(value)) return value as "CREATED" | "RELEASED" | "SETTLED" | "FAILED";
  return undefined;
}

async function note(offerId: string, type: string, message: string, actorId?: string): Promise<void> {
  await Activity.create({
    offerId,
    actorId,
    type,
    message,
  });
}

/**
 * Claim a successful card payment and create one held split per share.
 * Safe to call twice: the payment claim and the split request ids both collapse duplicates.
 */
export async function onFundingSucceeded(offerId: string, gateway: SplitGateway = liveSplits): Promise<void> {
  await connectDb();
  const pending = await Payment.findOne({ offerId, rail: "CARD", status: "PENDING" }).sort({ attempt: -1 });
  if (pending) {
    await Payment.findOneAndUpdate({ _id: pending._id, status: "PENDING" }, { $set: { status: "SUCCEEDED" } });
  }
  const payment = await Payment.findOne({ offerId, rail: "CARD", status: "SUCCEEDED" }).sort({ attempt: -1 });
  const intentId = payment?.paymentIntentId;
  if (!payment || !intentId) return;

  const offer = await Offer.findById(offerId);
  if (!offer || (offer.status !== "AWAITING_PAYMENT" && offer.status !== "ACTIVE")) return;

  const [seller, settings] = await Promise.all([User.findById(offer.sellerId), PlatformSettings.findById("default")]);
  const sellerAccount = seller?.airwallex.accountId;
  const revenueAccount = settings?.revenueAccountId;
  if (!sellerAccount || !revenueAccount) {
    throw new Error("Cannot hold funds: the seller or the revenue account is missing.");
  }

  for (const milestone of offer.milestones) {
    if (milestone.status !== "PENDING_FUNDING") continue;
    if (milestone.breakdown.sellerMinor <= 0) throw new Error(`Milestone ${milestone.title} has no seller share to hold.`);
    const sellerSplit = await gateway.createFundsSplit({
      amountMinor: milestone.breakdown.sellerMinor,
      currency: offer.currency,
      destination: sellerAccount,
      sourceId: intentId,
      requestId: sellerSplitRequestId(milestone._id.toString()),
      autoRelease: false,
      metadata: { offerId, milestoneId: milestone._id.toString(), share: "SELLER" },
      relatedOfferId: offerId,
      relatedMilestoneId: milestone._id.toString(),
    });
    const revenue =
      milestone.breakdown.revenueMinor > 0
        ? await gateway.createFundsSplit({
            amountMinor: milestone.breakdown.revenueMinor,
            currency: offer.currency,
            destination: revenueAccount,
            sourceId: intentId,
            requestId: revenueSplitRequestId(milestone._id.toString()),
            autoRelease: false,
            metadata: { offerId, milestoneId: milestone._id.toString(), share: "REVENUE" },
            relatedOfferId: offerId,
            relatedMilestoneId: milestone._id.toString(),
          })
        : undefined;
    const sellerSplitId = readString(sellerSplit, "id");
    if (!sellerSplitId) throw new Error("Funds split did not return an id.");
    const revenueId = revenue ? readString(revenue, "id") : undefined;
    if (revenue && !revenueId) throw new Error("Revenue funds split did not return an id.");
    const sellerStatus = knownSplitStatus(readString(sellerSplit, "status")) ?? "CREATED";
    const revenueStatus = revenue ? (knownSplitStatus(readString(revenue, "status")) ?? "CREATED") : undefined;
    await Offer.findOneAndUpdate(
      { _id: offer._id, milestones: { $elemMatch: { _id: milestone._id, status: "PENDING_FUNDING" } } },
      {
        $set: {
          "milestones.$.status": "FUNDED",
          "milestones.$.escrow.sellerSplit": {
            splitId: sellerSplitId,
            amountMinor: milestone.breakdown.sellerMinor,
            destination: sellerAccount,
            status: sellerStatus,
          },
          ...(revenue && revenueId && revenueStatus
            ? {
                "milestones.$.escrow.revenueSplit": {
                  splitId: revenueId,
                  amountMinor: milestone.breakdown.revenueMinor,
                  destination: revenueAccount,
                  status: revenueStatus,
                },
              }
            : {}),
        },
      },
    );
  }

  const current = await Offer.findById(offerId);
  if (!current || current.milestones.some((milestone) => milestone.status === "PENDING_FUNDING")) return;
  const activated = await Offer.findOneAndUpdate(
    { _id: offerId, status: "AWAITING_PAYMENT" },
    {
      $set: {
        status: "ACTIVE",
        fundingRail: "CARD",
        fundedAt: new Date(),
        acceptedAt: current.acceptedAt ?? new Date(),
      },
    },
  );
  if (!activated) return;
  await note(offerId, "PAYMENT_SUCCEEDED", "Payment received by card", offer.buyerId.toString());
  await note(offerId, "SPLITS_CREATED", "Funds held in escrow", offer.buyerId.toString());
}

export async function advanceSplitStatus(splitId: string, next: string): Promise<string | undefined> {
  await connectDb();
  const status = knownSplitStatus(next);
  if (!status) return undefined;
  const offer = await Offer.findOne({
    $or: [{ "milestones.escrow.sellerSplit.splitId": splitId }, { "milestones.escrow.revenueSplit.splitId": splitId }],
  });
  if (!offer) return undefined;
  for (const milestone of offer.milestones) {
    if (milestone.escrow?.sellerSplit?.splitId === splitId && canAdvanceSplit(milestone.escrow.sellerSplit.status, status)) {
      await Offer.updateOne(
        { _id: offer._id, "milestones.escrow.sellerSplit.splitId": splitId, "milestones.escrow.sellerSplit.status": milestone.escrow.sellerSplit.status },
        { $set: { "milestones.$.escrow.sellerSplit.status": status } },
      );
    }
    if (milestone.escrow?.revenueSplit?.splitId === splitId && canAdvanceSplit(milestone.escrow.revenueSplit.status, status)) {
      await Offer.updateOne(
        { _id: offer._id, "milestones.escrow.revenueSplit.splitId": splitId, "milestones.escrow.revenueSplit.status": milestone.escrow.revenueSplit.status },
        { $set: { "milestones.$.escrow.revenueSplit.status": status } },
      );
    }
  }
  return offer._id.toString();
}

export async function refreshSplits(offerId: string, gateway: SplitGateway = liveSplits): Promise<void> {
  const offer = await Offer.findById(offerId);
  if (!offer) return;
  for (const milestone of offer.milestones) {
    for (const splitId of [milestone.escrow?.sellerSplit?.splitId, milestone.escrow?.revenueSplit?.splitId]) {
      if (!splitId) continue;
      const latest = await gateway.retrieveFundsSplit(splitId);
      const status = readString(latest, "status");
      if (status) await advanceSplitStatus(splitId, status);
    }
  }
}

export async function markCardPaymentFailed(paymentIntentId: string, next: "FAILED" | "CANCELLED"): Promise<string | undefined> {
  await connectDb();
  const payment = await Payment.findOneAndUpdate(
    { paymentIntentId, status: "PENDING" },
    { $set: { status: next, failureReason: next === "FAILED" ? "Card payment was declined" : undefined } },
    { returnDocument: "after" },
  );
  if (!payment) {
    const existing = await Payment.findOne({ paymentIntentId });
    return existing?.offerId.toString();
  }
  const offer = await Offer.findOneAndUpdate(
    { _id: payment.offerId, status: "AWAITING_PAYMENT" },
    { $set: { status: "SENT" }, $unset: { fundingRail: "" } },
  );
  if (offer) {
    await note(payment.offerId.toString(), "PAYMENT_FAILED", next === "FAILED" ? "Card payment was declined" : "Card payment was cancelled", offer.buyerId.toString());
  }
  return payment.offerId.toString();
}
