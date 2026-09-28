import { Types } from "mongoose";
import { offerActions, milestoneActions } from "@/contracts/permissions";
import type { CancelReasonInput } from "@/contracts/offers";
import { AirwallexError } from "@/lib/airwallex/errors";
import { createFundsSplit, createFundsSplitReversal, releaseFundsSplit, retrieveFundsSplit, type CreateFundsSplitInput, type CreateReversalInput } from "@/lib/airwallex/fundsSplits";
import { readString, type JsonObject } from "@/lib/airwallex/json";
import { createRefund, retrieveRefund, type CreateRefundInput } from "@/lib/airwallex/refunds";
import { refundRequestId, releaseSplitRequestId, revenueSplitRequestId, revenueTransferRequestId, refundTransferRequestId, reverseSplitRequestId, sellerSplitRequestId, sellerTransferRequestId } from "@/lib/airwallex/requestIds";
import { createConnectedAccountTransfer, retrieveConnectedAccountTransfer, type ScaleReason } from "@/lib/airwallex/wallet";
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

export type RefundGateway = {
  createRefund: (input: CreateRefundInput) => Promise<JsonObject>;
  createFundsSplitReversal: (input: CreateReversalInput) => Promise<JsonObject>;
  retrieveRefund: (refundId: string) => Promise<JsonObject>;
};

const liveRefund: RefundGateway = { createRefund, createFundsSplitReversal, retrieveRefund };

export type TransferGateway = {
  createConnectedAccountTransfer: typeof createConnectedAccountTransfer;
  retrieveConnectedAccountTransfer: typeof retrieveConnectedAccountTransfer;
};

const liveTransfers: TransferGateway = { createConnectedAccountTransfer, retrieveConnectedAccountTransfer };
const TRANSFER_REASON: ScaleReason = "professional_business_services";

const REFUNDABLE = new Set(["FUNDED", "SUBMITTED", "CHANGES_REQUESTED"]);
const REFUND_RANK: Record<string, number> = { RECEIVED: 1, ACCEPTED: 2, SETTLED: 3 };
const REFUND_STATUSES = new Set(["RECEIVED", "ACCEPTED", "SETTLED", "FAILED"]);

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
  const latest = await Payment.findOne({ offerId }).sort({ attempt: -1 });
  if (latest?.rail === "WALLET" && (latest.status === "PENDING" || latest.status === "SUCCEEDED")) {
    if (latest.status === "PENDING") {
      await Payment.findOneAndUpdate({ _id: latest._id, status: "PENDING" }, { $set: { status: "SUCCEEDED" } });
    }
    await fundWalletMilestones(offerId);
    return;
  }
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

async function fundWalletMilestones(offerId: string): Promise<void> {
  const offer = await Offer.findById(offerId);
  if (!offer || (offer.status !== "AWAITING_PAYMENT" && offer.status !== "ACTIVE")) return;
  for (const milestone of offer.milestones) {
    if (milestone.status !== "PENDING_FUNDING") continue;
    await Offer.findOneAndUpdate(
      { _id: offer._id, milestones: { $elemMatch: { _id: milestone._id, status: "PENDING_FUNDING" } } },
      { $set: { "milestones.$.status": "FUNDED" } },
    );
  }
  const current = await Offer.findById(offerId);
  if (!current || current.milestones.some((milestone) => milestone.status === "PENDING_FUNDING")) return;
  const activated = await Offer.findOneAndUpdate(
    { _id: offerId, status: "AWAITING_PAYMENT" },
    {
      $set: {
        status: "ACTIVE",
        fundingRail: "WALLET",
        fundedAt: new Date(),
        acceptedAt: current.acceptedAt ?? new Date(),
      },
    },
  );
  if (!activated) return;
  await note(offerId, "PAYMENT_SUCCEEDED", "Payment received from wallet", offer.buyerId.toString());
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

/** A milestone is paid when every release leg has settled: card splits, or wallet transfers. Then the offer can complete. */
export async function maybeMarkPaid(offerId: string): Promise<void> {
  const offer = await Offer.findById(offerId);
  if (!offer) return;
  for (const milestone of offer.milestones) {
    if (milestone.status !== "RELEASING") continue;
    const sellerSettled =
      offer.fundingRail === "WALLET"
        ? milestone.escrow?.sellerTransfer?.status === "SETTLED"
        : milestone.escrow?.sellerSplit?.status === "SETTLED";
    const revenueTransfer = milestone.escrow?.revenueTransfer;
    const revenueSplit = milestone.escrow?.revenueSplit;
    const revenueSettled =
      milestone.breakdown.revenueMinor === 0 ||
      (offer.fundingRail === "WALLET" ? revenueTransfer?.status === "SETTLED" : revenueSplit?.status === "SETTLED");
    if (!sellerSettled || !revenueSettled) continue;
    const paid = await Offer.findOneAndUpdate(
      { _id: offer._id, milestones: { $elemMatch: { _id: milestone._id, status: "RELEASING" } } },
      { $set: { "milestones.$.status": "PAID", "milestones.$.paidAt": new Date() }, $unset: { "milestones.$.lastError": "" } },
    );
    if (paid) await note(offerId, "MILESTONE_PAID", `${milestone.title} paid`, undefined, milestone._id.toString());
  }
  await closeOffer(offerId);
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
  transfers: TransferGateway = liveTransfers,
) {
  const offer = await loadParticipant(offerId, user._id.toString());
  const milestone = milestoneOf(offer, milestoneId);
  if (!milestoneActions(milestone, offer, viewerRole(offer, user._id.toString())).includes("APPROVE")) {
    throw new InvalidState("That action isn't available.");
  }

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
  if (offer.fundingRail === "WALLET") await releaseWalletTransfers(offerId, milestoneId, transfers);
  else await releaseHeldSplits(offerId, milestoneId, gateway);
  return getOffer(user, offerId);
}

export async function retryMilestone(
  user: UserDocument,
  offerId: string,
  milestoneId: string,
  gateway: ReleaseGateway = liveRelease,
  refund: RefundGateway = liveRefund,
  transfers: TransferGateway = liveTransfers,
) {
  const offer = await loadParticipant(offerId, user._id.toString());
  const milestone = milestoneOf(offer, milestoneId);
  if (!milestoneActions(milestone, offer, viewerRole(offer, user._id.toString())).includes("RETRY")) {
    throw new InvalidState("That action isn't available.");
  }
  if (milestone.status === "REFUND_FAILED" || milestone.status === "REFUNDING") {
    const claimed = await Offer.findOneAndUpdate(
      {
        _id: offer._id,
        milestones: { $elemMatch: { _id: milestone._id, status: { $in: ["REFUNDING", "REFUND_FAILED"] } } },
      },
      { $set: { "milestones.$.status": "REFUNDING" }, $unset: { "milestones.$.lastError": "" } },
    );
    if (!claimed) throw new InvalidState("That action isn't available.");
    if (offer.fundingRail === "WALLET") await executeWalletRefund(offer._id.toString(), milestone._id.toString(), transfers);
    else await executeRefund(offer._id.toString(), milestone._id.toString(), refund);
    return getOffer(user, offerId);
  }
  const claimed = await Offer.findOneAndUpdate(
    {
      _id: offer._id,
      milestones: { $elemMatch: { _id: milestone._id, status: { $in: ["RELEASING", "RELEASE_FAILED"] } } },
    },
    { $set: { "milestones.$.status": "RELEASING" }, $unset: { "milestones.$.lastError": "" } },
  );
  if (!claimed) throw new InvalidState("That action isn't available.");
  if (offer.fundingRail === "WALLET") await releaseWalletTransfers(offerId, milestoneId, transfers);
  else await releaseHeldSplits(offerId, milestoneId, gateway);
  return getOffer(user, offerId);
}

async function closeOffer(offerId: string): Promise<void> {
  const current = await Offer.findById(offerId);
  if (!current || current.status !== "ACTIVE") return;
  const statuses = current.milestones.map((milestone) => milestone.status);
  if (!statuses.every((status) => status === "PAID" || status === "REFUNDED")) return;
  if (statuses.every((status) => status === "REFUNDED")) {
    const cancelled = await Offer.findOneAndUpdate(
      { _id: offerId, status: "ACTIVE" },
      { $set: { status: "CANCELLED", closedAt: new Date() } },
    );
    if (cancelled) await note(offerId, "OFFER_CANCELLED", "Offer cancelled");
    return;
  }
  const completed = await Offer.findOneAndUpdate(
    { _id: offerId, status: "ACTIVE" },
    { $set: { status: "COMPLETED", completedAt: new Date() } },
  );
  if (completed) await note(offerId, "OFFER_COMPLETED", "Offer completed");
}

function knownRefundStatus(value: string | undefined): "RECEIVED" | "ACCEPTED" | "SETTLED" | "FAILED" | undefined {
  if (value && REFUND_STATUSES.has(value)) return value as "RECEIVED" | "ACCEPTED" | "SETTLED" | "FAILED";
  return undefined;
}

function canAdvanceRefund(current: string, next: string): boolean {
  if (!REFUND_STATUSES.has(next) || current === next) return false;
  if (next === "FAILED") return current === "RECEIVED" || current === "ACCEPTED";
  return (REFUND_RANK[next] ?? 0) > (REFUND_RANK[current] ?? 0);
}

function reversalIsOptional(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  const code = error instanceof AirwallexError ? error.code : "";
  return `${code} ${message}`.toLowerCase().includes("insufficient");
}

async function markRefunded(offerId: string, milestoneId: Types.ObjectId, title: string): Promise<void> {
  const updated = await Offer.findOneAndUpdate(
    { _id: offerId, milestones: { $elemMatch: { _id: milestoneId, status: "REFUNDING" } } },
    { $set: { "milestones.$.status": "REFUNDED", "milestones.$.refundedAt": new Date() }, $unset: { "milestones.$.lastError": "" } },
  );
  if (updated) await note(offerId, "MILESTONE_REFUNDED", `${title} refunded`, undefined, milestoneId.toString());
  await closeOffer(offerId);
}

async function markRefundFailed(offerId: string, milestoneId: Types.ObjectId, message: string): Promise<void> {
  await Offer.updateOne(
    { _id: offerId, milestones: { $elemMatch: { _id: milestoneId, status: "REFUNDING" } } },
    { $set: { "milestones.$.status": "REFUND_FAILED", "milestones.$.lastError": message } },
  );
}

async function attachRefund(
  offerId: string,
  milestoneId: Types.ObjectId,
  refundId: string,
  status: string,
  amountMinor: number,
): Promise<void> {
  const attached = await Offer.findOneAndUpdate(
    {
      _id: offerId,
      milestones: { $elemMatch: { _id: milestoneId, status: "REFUNDING", "escrow.refund.refundId": { $exists: false } } },
    },
    { $set: { "milestones.$.escrow.refund": { refundId, status } } },
  );
  if (!attached) return;
  const payment = await Payment.findOne({ offerId, rail: "CARD", status: "SUCCEEDED" }).sort({ attempt: -1 });
  if (payment) await Payment.updateOne({ _id: payment._id }, { $inc: { refundedMinor: amountMinor } });
}

/** Update a stored refund. Accepted or settled refunds pay the milestone out. */
export async function advanceRefundStatus(refundId: string, next: string, milestoneId?: string): Promise<string | undefined> {
  await connectDb();
  const status = knownRefundStatus(next);
  if (!status) return undefined;
  let offer = await Offer.findOne({ "milestones.escrow.refund.refundId": refundId });
  if (!offer && milestoneId && Types.ObjectId.isValid(milestoneId)) {
    offer = await Offer.findOne({ "milestones._id": milestoneId });
  }
  if (!offer) return undefined;
  const milestone = offer.milestones.find(
    (item) => item.escrow?.refund?.refundId === refundId || (milestoneId !== undefined && item._id.toString() === milestoneId),
  );
  if (!milestone) return offer._id.toString();
  if (!milestone.escrow?.refund?.refundId) {
    await attachRefund(offer._id.toString(), milestone._id, refundId, status, milestone.amountMinor);
  } else if (canAdvanceRefund(milestone.escrow.refund.status, status)) {
    await Offer.updateOne(
      {
        _id: offer._id,
        milestones: { $elemMatch: { "escrow.refund.refundId": refundId, "escrow.refund.status": milestone.escrow.refund.status } },
      },
      { $set: { "milestones.$.escrow.refund.status": status } },
    );
  }
  if (status === "FAILED") await markRefundFailed(offer._id.toString(), milestone._id, "The refund failed.");
  if (status === "ACCEPTED" || status === "SETTLED") await markRefunded(offer._id.toString(), milestone._id, milestone.title);
  return offer._id.toString();
}

async function reverseSplit(
  offerId: string,
  milestoneId: Types.ObjectId,
  side: "sellerSplit" | "revenueSplit",
  split: { splitId: string; amountMinor: number },
  currency: string,
  gateway: RefundGateway,
): Promise<void> {
  try {
    const reversal = await gateway.createFundsSplitReversal({
      fundsSplitId: split.splitId,
      amountMinor: split.amountMinor,
      currency,
      requestId: reverseSplitRequestId(split.splitId),
    });
    const reversalId = readString(reversal, "id");
    if (!reversalId) return;
    await Offer.updateOne(
      { _id: offerId, milestones: { $elemMatch: { _id: milestoneId, [`escrow.${side}.splitId`]: split.splitId } } },
      {
        $set: {
          [`milestones.$.escrow.${side}.reversalId`]: reversalId,
          [`milestones.$.escrow.${side}.reversalStatus`]: readString(reversal, "status") ?? "RECEIVED",
        },
      },
    );
  } catch (error) {
    // AIRWALLEX: reversing a split that has not settled returns insufficient funds while the destination balance is still 0 (R7). The card refund still proceeds.
    if (!reversalIsOptional(error)) throw error;
  }
}

async function executeRefund(offerId: string, milestoneId: string, gateway: RefundGateway): Promise<void> {
  const offer = await Offer.findById(offerId);
  const milestone = offer?.milestones.find((item) => item._id.toString() === milestoneId);
  if (!offer || !milestone) return;
  try {
    const payment = await Payment.findOne({ offerId: offer._id, rail: "CARD", status: "SUCCEEDED" }).sort({ attempt: -1 });
    if (!payment?.paymentIntentId) throw new Error("This offer has no card payment to refund.");
    const created = await gateway.createRefund({
      paymentIntentId: payment.paymentIntentId,
      amountMinor: milestone.amountMinor,
      currency: offer.currency,
      requestId: refundRequestId(milestoneId),
      reason: "Milestone cancelled",
      metadata: { offerId, milestoneId },
      relatedMilestoneId: milestoneId,
    });
    const refundId = readString(created, "id");
    if (!refundId) throw new Error("Refund did not return an id.");
    const status = readString(created, "status") ?? "RECEIVED";
    await attachRefund(offerId, milestone._id, refundId, status, milestone.amountMinor);
    for (const [side, split] of [
      ["sellerSplit", milestone.escrow?.sellerSplit],
      ["revenueSplit", milestone.escrow?.revenueSplit],
    ] as const) {
      if (!split) continue;
      await reverseSplit(offerId, milestone._id, side, split, offer.currency, gateway);
    }
    await advanceRefundStatus(refundId, status, milestoneId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Refund failed.";
    await Offer.updateOne(
      { _id: offerId, milestones: { $elemMatch: { _id: milestone._id, status: "REFUNDING" } } },
      { $set: { "milestones.$.lastError": message } },
    );
  }
}

async function claimRefund(offer: OfferDocument, milestoneId: Types.ObjectId): Promise<boolean> {
  const claimed = await Offer.findOneAndUpdate(
    {
      _id: offer._id,
      status: "ACTIVE",
      milestones: { $elemMatch: { _id: milestoneId, status: { $in: [...REFUNDABLE] } } },
    },
    { $set: { "milestones.$.status": "REFUNDING" }, $unset: { "milestones.$.lastError": "" } },
  );
  return Boolean(claimed);
}

export async function refundMilestone(
  user: UserDocument,
  offerId: string,
  milestoneId: string,
  input: CancelReasonInput = {},
  gateway: RefundGateway = liveRefund,
  transfers: TransferGateway = liveTransfers,
) {
  const offer = await loadParticipant(offerId, user._id.toString());
  const milestone = milestoneOf(offer, milestoneId);
  if (!milestoneActions(milestone, offer, viewerRole(offer, user._id.toString())).includes("CANCEL")) {
    throw new InvalidState("That action isn't available.");
  }
  const claimed = await claimRefund(offer, milestone._id);
  if (!claimed) throw new InvalidState("That action isn't available.");
  const reason = input.reason?.trim();
  await note(
    offerId,
    "MILESTONE_CANCELLED",
    reason ? `${user.name} cancelled ${milestone.title}: ${reason}` : `${user.name} cancelled ${milestone.title}`,
    user._id.toString(),
    milestoneId,
  );
  if (offer.fundingRail === "WALLET") await executeWalletRefund(offerId, milestoneId, transfers);
  else await executeRefund(offerId, milestoneId, gateway);
  return getOffer(user, offerId);
}

export async function cancelRemaining(
  user: UserDocument,
  offerId: string,
  input: CancelReasonInput = {},
  gateway: RefundGateway = liveRefund,
  transfers: TransferGateway = liveTransfers,
) {
  const offer = await loadParticipant(offerId, user._id.toString());
  if (!offerActions(offer, viewerRole(offer, user._id.toString())).includes("CANCEL_REMAINING")) {
    throw new InvalidState("That action isn't available.");
  }
  const reason = input.reason?.trim();
  const current = await Offer.findById(offer._id);
  for (const milestone of current?.milestones ?? []) {
    if (!REFUNDABLE.has(milestone.status)) continue;
    const claimed = await claimRefund(offer, milestone._id);
    if (!claimed) continue;
    await note(
      offerId,
      "MILESTONE_CANCELLED",
      reason ? `${user.name} cancelled ${milestone.title}: ${reason}` : `${user.name} cancelled ${milestone.title}`,
      user._id.toString(),
      milestone._id.toString(),
    );
    if (offer.fundingRail === "WALLET") await executeWalletRefund(offerId, milestone._id.toString(), transfers);
    else await executeRefund(offerId, milestone._id.toString(), gateway);
  }
  return getOffer(user, offerId);
}

export async function refreshRefunds(offerId: string, gateway: RefundGateway = liveRefund): Promise<void> {
  const offer = await Offer.findById(offerId);
  if (!offer) return;
  for (const milestone of offer.milestones) {
    const refundId = milestone.escrow?.refund?.refundId;
    if (!refundId || milestone.status !== "REFUNDING") continue;
    const latest = await gateway.retrieveRefund(refundId);
    const status = readString(latest, "status");
    if (status) await advanceRefundStatus(refundId, status, milestone._id.toString());
  }
}

const TRANSFER_RANK: Record<string, number> = { NEW: 1, PENDING: 2, SETTLED: 3 };
const TRANSFER_STATUSES = new Set(["NEW", "PENDING", "SETTLED", "SUSPENDED", "FAILED"]);

function knownTransferStatus(value: string | undefined): "NEW" | "PENDING" | "SETTLED" | "SUSPENDED" | "FAILED" | undefined {
  if (value && TRANSFER_STATUSES.has(value)) return value as "NEW" | "PENDING" | "SETTLED" | "SUSPENDED" | "FAILED";
  return undefined;
}

function canAdvanceTransfer(current: string, next: string): boolean {
  if (!TRANSFER_STATUSES.has(next) || current === next) return false;
  if (next === "FAILED" || next === "SUSPENDED") return current === "NEW" || current === "PENDING";
  return (TRANSFER_RANK[next] ?? 0) > (TRANSFER_RANK[current] ?? 0);
}

async function storeTransfer(
  offerId: string,
  milestoneId: Types.ObjectId,
  side: "sellerTransfer" | "revenueTransfer" | "refundTransfer",
  transfer: { transferId: string; amountMinor: number; destination: string; status: string },
): Promise<void> {
  await Offer.updateOne(
    { _id: offerId, milestones: { $elemMatch: { _id: milestoneId, [`escrow.${side}.transferId`]: { $exists: false } } } },
    { $set: { [`milestones.$.escrow.${side}`]: transfer } },
  );
}

export async function advanceTransferStatus(transferId: string, next: string): Promise<string | undefined> {
  await connectDb();
  const status = knownTransferStatus(next);
  if (!status) return undefined;
  const offer = await Offer.findOne({
    $or: [
      { "milestones.escrow.sellerTransfer.transferId": transferId },
      { "milestones.escrow.revenueTransfer.transferId": transferId },
      { "milestones.escrow.refundTransfer.transferId": transferId },
    ],
  });
  if (!offer) return undefined;
  for (const milestone of offer.milestones) {
    for (const side of ["sellerTransfer", "revenueTransfer", "refundTransfer"] as const) {
      const current = milestone.escrow?.[side];
      if (current?.transferId !== transferId || !canAdvanceTransfer(current.status, status)) continue;
      await Offer.updateOne(
        {
          _id: offer._id,
          milestones: { $elemMatch: { [`escrow.${side}.transferId`]: transferId, [`escrow.${side}.status`]: current.status } },
        },
        { $set: { [`milestones.$.escrow.${side}.status`]: status } },
      );
      if ((side === "sellerTransfer" || side === "revenueTransfer") && (status === "FAILED" || status === "SUSPENDED")) {
        await markReleaseFailed(offer._id.toString(), milestone._id, "The wallet transfer did not settle.");
      }
      if (side === "refundTransfer" && (status === "FAILED" || status === "SUSPENDED")) {
        await markRefundFailed(offer._id.toString(), milestone._id, "The refund transfer did not settle.");
      }
      if (side === "refundTransfer" && status === "SETTLED") {
        await markRefunded(offer._id.toString(), milestone._id, milestone.title);
      }
    }
  }
  if (status === "SETTLED") await maybeMarkPaid(offer._id.toString());
  return offer._id.toString();
}

async function openTransfer(
  gateway: TransferGateway,
  input: { amountMinor: number; currency: string; destination: string; requestId: string; reference: string; offerId: string },
): Promise<{ transferId: string; status: string }> {
  const created = await gateway.createConnectedAccountTransfer({
    amountMinor: input.amountMinor,
    currency: input.currency,
    destination: input.destination,
    requestId: input.requestId,
    reason: TRANSFER_REASON,
    reference: input.reference.slice(0, 140),
    relatedOfferId: input.offerId,
  });
  const transferId = readString(created, "id");
  if (!transferId) throw new Error("Connected account transfer did not return an id.");
  return { transferId, status: knownTransferStatus(readString(created, "status")) ?? "PENDING" };
}

async function releaseWalletTransfers(offerId: string, milestoneId: string, gateway: TransferGateway): Promise<void> {
  const offer = await Offer.findById(offerId);
  const milestone = offer?.milestones.find((item) => item._id.toString() === milestoneId);
  if (!offer || !milestone) return;
  try {
    const [seller, settings] = await Promise.all([User.findById(offer.sellerId), PlatformSettings.findById("default")]);
    const sellerAccount = seller?.airwallex.accountId;
    const revenueAccount = settings?.revenueAccountId;
    if (!sellerAccount || !revenueAccount) throw new Error("Cannot release funds: the seller or the revenue account is missing.");
    const sellerTransfer = await openTransfer(gateway, {
      amountMinor: milestone.breakdown.sellerMinor,
      currency: offer.currency,
      destination: sellerAccount,
      requestId: sellerTransferRequestId(milestoneId),
      reference: `${offer.shortRef} ${milestone.title}`,
      offerId,
    });
    await storeTransfer(offerId, milestone._id, "sellerTransfer", {
      transferId: sellerTransfer.transferId,
      amountMinor: milestone.breakdown.sellerMinor,
      destination: sellerAccount,
      status: "NEW",
    });
    await advanceTransferStatus(sellerTransfer.transferId, sellerTransfer.status);
    if (milestone.breakdown.revenueMinor > 0) {
      const revenueTransfer = await openTransfer(gateway, {
        amountMinor: milestone.breakdown.revenueMinor,
        currency: offer.currency,
        destination: revenueAccount,
        requestId: revenueTransferRequestId(milestoneId),
        reference: `${offer.shortRef} ${milestone.title} fee`,
        offerId,
      });
      await storeTransfer(offerId, milestone._id, "revenueTransfer", {
        transferId: revenueTransfer.transferId,
        amountMinor: milestone.breakdown.revenueMinor,
        destination: revenueAccount,
        status: "NEW",
      });
      await advanceTransferStatus(revenueTransfer.transferId, revenueTransfer.status);
    }
    await note(offerId, "FUNDS_RELEASED", `Funds released for ${milestone.title}`, offer.buyerId.toString(), milestoneId);
    await maybeMarkPaid(offerId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Release failed.";
    await Offer.updateOne(
      { _id: offerId, milestones: { $elemMatch: { _id: milestone._id, status: "RELEASING" } } },
      { $set: { "milestones.$.lastError": message } },
    );
  }
}

async function executeWalletRefund(offerId: string, milestoneId: string, gateway: TransferGateway): Promise<void> {
  const offer = await Offer.findById(offerId);
  const milestone = offer?.milestones.find((item) => item._id.toString() === milestoneId);
  if (!offer || !milestone) return;
  try {
    const buyer = await User.findById(offer.buyerId);
    const destination = buyer?.airwallex.accountId;
    if (!destination) throw new Error("The buyer's Airwallex account isn't ready.");
    const transfer = await openTransfer(gateway, {
      amountMinor: milestone.amountMinor,
      currency: offer.currency,
      destination,
      requestId: refundTransferRequestId(milestoneId),
      reference: `Refund ${offer.shortRef} ${milestone.title}`,
      offerId,
    });
    await storeTransfer(offerId, milestone._id, "refundTransfer", {
      transferId: transfer.transferId,
      amountMinor: milestone.amountMinor,
      destination,
      status: "NEW",
    });
    await advanceTransferStatus(transfer.transferId, transfer.status);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Refund failed.";
    await Offer.updateOne(
      { _id: offerId, milestones: { $elemMatch: { _id: milestone._id, status: "REFUNDING" } } },
      { $set: { "milestones.$.lastError": message } },
    );
  }
}

export async function refreshTransfers(offerId: string, gateway: TransferGateway = liveTransfers): Promise<void> {
  const offer = await Offer.findById(offerId);
  if (!offer || offer.fundingRail !== "WALLET") return;
  for (const milestone of offer.milestones) {
    if (milestone.status !== "RELEASING" && milestone.status !== "REFUNDING") continue;
    const ids = [
      milestone.escrow?.sellerTransfer?.transferId,
      milestone.escrow?.revenueTransfer?.transferId,
      milestone.escrow?.refundTransfer?.transferId,
    ];
    for (const transferId of ids) {
      if (!transferId) continue;
      const latest = await gateway.retrieveConnectedAccountTransfer(transferId);
      const status = readString(latest, "status");
      if (status) await advanceTransferStatus(transferId, status);
    }
  }
}
