import type { ActivityItemDTO } from "@/contracts/activity";
import { ActivityItemSchema } from "@/contracts/activity";
import type { ReleaseLegDTO, OfferDTO, OfferSummaryDTO } from "@/contracts/offers";
import { OfferSchema, OfferSummarySchema } from "@/contracts/offers";
import { milestoneActions, milestoneIsPending, offerActions, offerIsPending } from "@/contracts/permissions";
import { milestoneActionOptions } from "@/server/milestoneOptions";
import type { PaymentDocument } from "@/models/payment";
import type { OfferDocument } from "@/models/offer";
import type { UserDocument } from "@/models/user";
import { toUserSummary } from "@/server/dto/users";

const HELD = new Set(["FUNDED", "SUBMITTED", "CHANGES_REQUESTED", "RELEASING", "RELEASE_FAILED"]);

function money(amountMinor: number, currency: string) {
  return { amountMinor, currency };
}

function iso(date: Date | undefined): string | undefined {
  return date?.toISOString();
}

function day(date: Date | undefined): string | undefined {
  return date ? date.toISOString().slice(0, 10) : undefined;
}

function role(offer: OfferDocument, viewerId: string): "BUYER" | "SELLER" {
  return offer.buyerId.toString() === viewerId ? "BUYER" : "SELLER";
}

function releaseLegs(milestone: OfferDocument["milestones"][number], currency: string): ReleaseLegDTO[] {
  const release = milestone.release;
  if (!release) return [];
  const legs: ReleaseLegDTO[] = [];
  if (release.sellerSplit) {
    legs.push({
      kind: "FUNDS_SPLIT",
      share: "SELLER",
      airwallexId: release.sellerSplit.splitId,
      amount: money(release.sellerSplit.amountMinor, currency),
      status: release.sellerSplit.status,
    });
  }
  if (release.revenueSplit) {
    legs.push({
      kind: "FUNDS_SPLIT",
      share: "REVENUE",
      airwallexId: release.revenueSplit.splitId,
      amount: money(release.revenueSplit.amountMinor, currency),
      status: release.revenueSplit.status,
    });
  }
  if (release.sellerTransfer) {
    legs.push({
      kind: "CA_TRANSFER",
      share: "SELLER",
      airwallexId: release.sellerTransfer.transferId,
      amount: money(release.sellerTransfer.amountMinor, currency),
      status: release.sellerTransfer.status,
    });
  }
  if (release.revenueTransfer) {
    legs.push({
      kind: "CA_TRANSFER",
      share: "REVENUE",
      airwallexId: release.revenueTransfer.transferId,
      amount: money(release.revenueTransfer.amountMinor, currency),
      status: release.revenueTransfer.status,
    });
  }
  if (release.refund) {
    legs.push({
      kind: "REFUND",
      share: "BUYER_REFUND",
      airwallexId: release.refund.refundId,
      amount: money(milestone.amountMinor, currency),
      status: release.refund.status,
    });
  }
  if (release.refundTransfer) {
    legs.push({
      kind: "CA_TRANSFER",
      share: "BUYER_REFUND",
      airwallexId: release.refundTransfer.transferId,
      amount: money(release.refundTransfer.amountMinor, currency),
      status: release.refundTransfer.status,
    });
  }
  return legs;
}

function nextAction(offer: OfferDocument, viewerRole: "BUYER" | "SELLER"): OfferDTO["nextAction"] {
  if (viewerRole === "BUYER" && offer.status === "SENT") return { label: "Review offer" };
  if (viewerRole === "BUYER" && offer.status === "AWAITING_PAYMENT") return { label: "Continue payment" };
  if (viewerRole === "BUYER") {
    const submitted = offer.milestones.find((milestone) => milestone.status === "SUBMITTED");
    if (submitted) return { label: `Review delivery for Milestone ${submitted.index + 1}`, milestoneId: submitted._id.toString() };
  }
  if (viewerRole === "SELLER") {
    const deliver = offer.milestones.find((milestone) => milestone.status === "FUNDED" || milestone.status === "CHANGES_REQUESTED");
    if (deliver) return { label: `Deliver Milestone ${deliver.index + 1}`, milestoneId: deliver._id.toString() };
  }
  return undefined;
}

export function toOffer(
  offer: OfferDocument,
  viewerId: string,
  seller: UserDocument,
  buyer: UserDocument,
  payment?: Pick<PaymentDocument, "rail" | "status" | "paymentIntentId" | "chargeId"> | null,
): OfferDTO {
  const viewerRole = role(offer, viewerId);
  const currency = offer.currency;
  const counts: OfferDTO["milestoneCounts"] = {};
  for (const milestone of offer.milestones) {
    counts[milestone.status] = (counts[milestone.status] ?? 0) + 1;
  }
  const sum = (pick: (milestone: OfferDocument["milestones"][number]) => boolean) =>
    offer.milestones.filter(pick).reduce((total, milestone) => total + milestone.amountMinor, 0);
  const fees = offer.milestones.reduce(
    (total, milestone) => ({
      sellerMinor: total.sellerMinor + milestone.breakdown.sellerMinor,
      revenueMinor: total.revenueMinor + milestone.breakdown.revenueMinor,
      reserveMinor: total.reserveMinor + milestone.breakdown.reserveMinor,
    }),
    { sellerMinor: 0, revenueMinor: 0, reserveMinor: 0 },
  );

  return OfferSchema.parse({
    id: offer._id.toString(),
    shortRef: offer.shortRef,
    title: offer.title,
    description: offer.description,
    status: offer.status,
    viewerRole,
    seller: toUserSummary(seller),
    buyer: toUserSummary(buyer),
    total: money(sum(() => true), currency),
    released: money(sum((milestone) => milestone.status === "PAID"), currency),
    refunded: money(sum((milestone) => milestone.status === "REFUNDED"), currency),
    milestoneCount: offer.milestones.length,
    milestoneCounts: counts,
    nextAction: nextAction(offer, viewerRole),
    isWelcomeOffer: offer.isWelcomeOffer,
    sentAt: iso(offer.sentAt ?? offer.createdAt),
    updatedAt: iso(offer.updatedAt),
    fundingRail: offer.fundingRail,
    feeSnapshot: offer.feeSnapshot,
    totals: {
      held: money(sum((milestone) => HELD.has(milestone.status)), currency),
      released: money(sum((milestone) => milestone.status === "PAID"), currency),
      refunded: money(sum((milestone) => milestone.status === "REFUNDED"), currency),
      fees: {
        seller: money(fees.sellerMinor, currency),
        revenue: money(fees.revenueMinor, currency),
        reserve: money(fees.reserveMinor, currency),
        fee: money(fees.revenueMinor + fees.reserveMinor, currency),
      },
    },
    milestones: offer.milestones.map((milestone) => ({
      id: milestone._id.toString(),
      index: milestone.index,
      title: milestone.title,
      description: milestone.description || undefined,
      dueDate: day(milestone.dueDate),
      amount: money(milestone.amountMinor, currency),
      breakdown: {
        seller: money(milestone.breakdown.sellerMinor, currency),
        revenue: money(milestone.breakdown.revenueMinor, currency),
        reserve: money(milestone.breakdown.reserveMinor, currency),
        fee: money(milestone.breakdown.revenueMinor + milestone.breakdown.reserveMinor, currency),
      },
      status: milestone.status,
      isPending: milestoneIsPending(milestone.status),
      deliveries: milestone.deliveries.map((delivery) => ({
        id: delivery._id.toString(),
        links: delivery.links,
        note: delivery.note || undefined,
        submittedAt: delivery.submittedAt.toISOString(),
        review: delivery.review
          ? {
              decision: delivery.review.decision,
              comment: delivery.review.comment || undefined,
              reviewedAt: delivery.review.reviewedAt.toISOString(),
            }
          : undefined,
      })),
      releaseLegs: releaseLegs(milestone, currency),
      allowedActions: milestoneActions(milestone, offer, viewerRole, milestoneActionOptions()),
      approvedAt: iso(milestone.approvedAt),
      paidAt: iso(milestone.paidAt),
      refundedAt: iso(milestone.refundedAt),
      lastError: milestone.lastError || undefined,
    })),
    allowedActions: offerActions(offer, viewerRole),
    isPending: offerIsPending(offer),
    payment: payment
      ? {
          rail: payment.rail,
          status: payment.status,
          ...(payment.paymentIntentId ? { paymentIntentId: payment.paymentIntentId } : {}),
          ...(payment.chargeId ? { chargeId: payment.chargeId } : {}),
        }
      : undefined,
    acceptedAt: iso(offer.acceptedAt),
    fundedAt: iso(offer.fundedAt),
    completedAt: iso(offer.completedAt),
  });
}

export function toSummary(offer: OfferDocument, viewerId: string, seller: UserDocument, buyer: UserDocument): OfferSummaryDTO {
  const full = toOffer(offer, viewerId, seller, buyer);
  return OfferSummarySchema.parse({
    id: full.id,
    shortRef: full.shortRef,
    title: full.title,
    status: full.status,
    viewerRole: full.viewerRole,
    counterparty: full.viewerRole === "BUYER" ? full.seller : full.buyer,
    total: full.total,
    released: full.released,
    refunded: full.refunded,
    milestoneCount: full.milestoneCount,
    milestoneCounts: full.milestoneCounts,
    nextAction: full.nextAction,
    isWelcomeOffer: full.isWelcomeOffer,
    sentAt: full.sentAt,
    updatedAt: full.updatedAt,
  });
}

export function toActivity(
  item: { _id: { toString(): string }; type: string; message: string; meta?: unknown; createdAt: Date },
  actor?: UserDocument,
): ActivityItemDTO {
  const milestoneId =
    item.meta && typeof item.meta === "object" && "milestoneId" in item.meta && typeof item.meta.milestoneId === "string"
      ? item.meta.milestoneId
      : undefined;
  return ActivityItemSchema.parse({
    id: item._id.toString(),
    type: item.type,
    message: item.message,
    actor: actor ? toUserSummary(actor) : undefined,
    milestoneId,
    createdAt: item.createdAt.toISOString(),
  });
}
