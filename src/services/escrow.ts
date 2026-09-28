import { Types } from "mongoose";
import { milestoneActions } from "@/contracts/permissions";
import { readString, type JsonObject } from "@/lib/airwallex/json";
import { createFundsSplit, releaseFundsSplit, retrieveFundsSplit, type CreateFundsSplitInput } from "@/lib/airwallex/fundsSplits";
import { releaseSplitRequestId, revenueSplitRequestId, sellerSplitRequestId } from "@/lib/airwallex/requestIds";
import { connectDb } from "@/lib/db";
import { Activity } from "@/models/activity";
import { Offer, type OfferDocument } from "@/models/offer";
import { Payment } from "@/models/payment";
import { PlatformSettings } from "@/models/platformSettings";
import { User, type UserDocument } from "@/models/user";
import { Forbidden, InvalidState, NotFound } from "@/server/errors";
import { getOffer } from "@/services/offers";

const SPLIT_RANK: Record<string, number> = { CREATED: 1, RELEASED: 2, SETTLED: 3 };
const SPLIT_STATUSES = new Set(["CREATED", "RELEASED", "SETTLED", "FAILED"]);

export type SplitGateway = {
  createFundsSplit: (input: CreateFundsSplitInput) => Promise<JsonObject>;
  retrieveFundsSplit: (splitId: string) => Promise<JsonObject>;
};

const liveSplits: SplitGateway = { createFundsSplit, retrieveFundsSplit };

export type ReleaseGateway = {
  releaseFundsSplit: (splitId: string, requestId: string) => Promise<JsonObject>;
};

const liveRelease: ReleaseGateway = { releaseFundsSplit };

export function canAdvanceSplit(current: string, next: string): boolean {
  if (!SPLIT_STATUSES.has(next) || current === next) return false;
  if (next === "FAILED") return current === "CREATED" || current === "RELEASED";
  return (SPLIT_RANK[next] ?? 0) > (SPLIT_RANK[current] ?? 0);
}

function knownSplitStatus(value: string | undefined): "CREATED" | "RELEASED" | "SETTLED" | "FAILED" | undefined {
  if (value && SPLIT_STATUSES.has(value)) return value as "CREATED" | "RELEASED" | "SETTLED" | "FAILED";
  return undefined;
}

async function note(offerId: string, type: string, message: string, actorId?: string, milestoneId?: string): Promise<void> {
  await Activity.create({
    offerId,
    actorId,
    type,
    message,
    ...(milestoneId ? { meta: { milestoneId } } : {}),
  });
}

async function loadParticipant(offerId: string, userId: string): Promise<OfferDocument> {
  await connectDb();
  if (!Types.ObjectId.isValid(offerId)) throw new NotFound("Offer not found.");
  const offer = await Offer.findById(offerId);
  if (!offer) throw new NotFound("Offer not found.");
  if (offer.buyerId.toString() !== userId && offer.sellerId.toString() !== userId) {
    throw new Forbidden("You're not part of this offer.");
  }
  return offer;
}

function milestoneOf(offer: OfferDocument, milestoneId: string): OfferDocument["milestones"][number] {
  const milestone = offer.milestones.find((item) => item._id.toString() === milestoneId);
  if (!milestone) throw new NotFound("Milestone not found.");
  return milestone;
}

function viewerRole(offer: OfferDocument, userId: string): "BUYER" | "SELLER" {
  return offer.buyerId.toString() === userId ? "BUYER" : "SELLER";
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
  const touched: OfferDocument["milestones"][number][] = [];
  for (const milestone of offer.milestones) {
    const seller = milestone.escrow?.sellerSplit;
    if (seller?.splitId === splitId && canAdvanceSplit(seller.status, status)) {
      await Offer.updateOne(
        {
          _id: offer._id,
          milestones: { $elemMatch: { "escrow.sellerSplit.splitId": splitId, "escrow.sellerSplit.status": seller.status } },
        },
        { $set: { "milestones.$.escrow.sellerSplit.status": status } },
      );
      touched.push(milestone);
    }
    const revenue = milestone.escrow?.revenueSplit;
    if (revenue?.splitId === splitId && canAdvanceSplit(revenue.status, status)) {
      await Offer.updateOne(
        {
          _id: offer._id,
          milestones: { $elemMatch: { "escrow.revenueSplit.splitId": splitId, "escrow.revenueSplit.status": revenue.status } },
        },
        { $set: { "milestones.$.escrow.revenueSplit.status": status } },
      );
      touched.push(milestone);
    }
  }
  if (status === "FAILED") {
    for (const milestone of touched) {
      await markReleaseFailed(offer._id.toString(), milestone._id, "Airwallex could not release these funds.");
    }
  }
  if (status === "SETTLED" || status === "FAILED") await maybeMarkPaid(offer._id.toString());
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
  await maybeMarkPaid(offerId);
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

async function markReleaseFailed(offerId: string, milestoneId: Types.ObjectId, message: string): Promise<void> {
  await Offer.updateOne(
    { _id: offerId, milestones: { $elemMatch: { _id: milestoneId, status: "RELEASING" } } },
    { $set: { "milestones.$.status": "RELEASE_FAILED", "milestones.$.lastError": message } },
  );
}

/** A milestone is paid when every card-rail split has settled. Then the offer can complete. */
export async function maybeMarkPaid(offerId: string): Promise<void> {
  const offer = await Offer.findById(offerId);
  if (!offer) return;
  for (const milestone of offer.milestones) {
    if (milestone.status !== "RELEASING") continue;
    const sellerSettled = milestone.escrow?.sellerSplit?.status === "SETTLED";
    const revenue = milestone.escrow?.revenueSplit;
    const revenueSettled = milestone.breakdown.revenueMinor === 0 || revenue?.status === "SETTLED";
    if (!sellerSettled || !revenueSettled) continue;
    const paid = await Offer.findOneAndUpdate(
      { _id: offer._id, milestones: { $elemMatch: { _id: milestone._id, status: "RELEASING" } } },
      { $set: { "milestones.$.status": "PAID", "milestones.$.paidAt": new Date() }, $unset: { "milestones.$.lastError": "" } },
    );
    if (paid) await note(offerId, "MILESTONE_PAID", `${milestone.title} paid`, undefined, milestone._id.toString());
  }

  const current = await Offer.findById(offerId);
  if (!current || current.status !== "ACTIVE") return;
  const statuses = current.milestones.map((milestone) => milestone.status);
  const terminal = statuses.every((status) => status === "PAID" || status === "REFUNDED");
  if (!terminal || !statuses.includes("PAID")) return;
  const completed = await Offer.findOneAndUpdate(
    { _id: offerId, status: "ACTIVE" },
    { $set: { status: "COMPLETED", completedAt: new Date() } },
  );
  if (completed) await note(offerId, "OFFER_COMPLETED", "Offer completed");
}

async function releaseHeldSplits(offerId: string, milestoneId: string, gateway: ReleaseGateway): Promise<void> {
  const offer = await Offer.findById(offerId);
  const milestone = offer?.milestones.find((item) => item._id.toString() === milestoneId);
  if (!offer || !milestone) return;
  const splitIds = [milestone.escrow?.sellerSplit?.splitId, milestone.escrow?.revenueSplit?.splitId].filter(
    (splitId): splitId is string => Boolean(splitId),
  );
  try {
    if (splitIds.length === 0) throw new Error("This milestone has no funds to release.");
    for (const splitId of splitIds) {
      const released = await gateway.releaseFundsSplit(splitId, releaseSplitRequestId(splitId));
      const status = readString(released, "status") ?? "RELEASED";
      await advanceSplitStatus(splitId, status);
      if (status === "FAILED") throw new Error("Airwallex could not release these funds.");
    }
    await note(offerId, "FUNDS_RELEASED", `Funds released for ${milestone.title}`, offer.buyerId.toString(), milestoneId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Release failed.";
    await Offer.updateOne(
      { _id: offerId, milestones: { $elemMatch: { _id: milestone._id, status: "RELEASING" } } },
      { $set: { "milestones.$.lastError": message } },
    );
  }
}

export async function approveMilestone(
  user: UserDocument,
  offerId: string,
  milestoneId: string,
  gateway: ReleaseGateway = liveRelease,
) {
  const offer = await loadParticipant(offerId, user._id.toString());
  const milestone = milestoneOf(offer, milestoneId);
  if (!milestoneActions(milestone, offer, viewerRole(offer, user._id.toString())).includes("APPROVE")) {
    throw new InvalidState("That action isn't available.");
  }
  if (offer.fundingRail !== "CARD") throw new InvalidState("Wallet release isn't available yet.");

  const deliveries = milestone.deliveries.map((delivery, index) => ({
    _id: delivery._id,
    links: delivery.links,
    note: delivery.note,
    submittedAt: delivery.submittedAt,
    ...(index === milestone.deliveries.length - 1
      ? { review: { decision: "APPROVED" as const, reviewedAt: new Date() } }
      : delivery.review
        ? { review: delivery.review }
        : {}),
  }));
  const claimed = await Offer.findOneAndUpdate(
    { _id: offer._id, status: "ACTIVE", milestones: { $elemMatch: { _id: milestone._id, status: "SUBMITTED" } } },
    {
      $set: {
        "milestones.$.status": "RELEASING",
        "milestones.$.approvedAt": new Date(),
        "milestones.$.deliveries": deliveries,
      },
      $unset: { "milestones.$.lastError": "" },
    },
  );
  if (!claimed) throw new InvalidState("That action isn't available.");
  await note(offerId, "MILESTONE_APPROVED", `${user.name} approved ${milestone.title}`, user._id.toString(), milestoneId);
  await releaseHeldSplits(offerId, milestoneId, gateway);
  return getOffer(user, offerId);
}

export async function retryMilestone(
  user: UserDocument,
  offerId: string,
  milestoneId: string,
  gateway: ReleaseGateway = liveRelease,
) {
  const offer = await loadParticipant(offerId, user._id.toString());
  const milestone = milestoneOf(offer, milestoneId);
  if (!milestoneActions(milestone, offer, viewerRole(offer, user._id.toString())).includes("RETRY")) {
    throw new InvalidState("That action isn't available.");
  }
  if (milestone.status === "REFUND_FAILED" || milestone.status === "REFUNDING") {
    throw new InvalidState("Refund retry isn't available yet.");
  }
  const claimed = await Offer.findOneAndUpdate(
    {
      _id: offer._id,
      milestones: { $elemMatch: { _id: milestone._id, status: { $in: ["RELEASING", "RELEASE_FAILED"] } } },
    },
    { $set: { "milestones.$.status": "RELEASING" }, $unset: { "milestones.$.lastError": "" } },
  );
  if (!claimed) throw new InvalidState("That action isn't available.");
  await releaseHeldSplits(offerId, milestoneId, gateway);
  return getOffer(user, offerId);
}
