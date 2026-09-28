import type { ActivityItemDTO } from "@/contracts/activity";
import { ActivityItemSchema } from "@/contracts/activity";
import type { EscrowLegDTO, OfferDTO, OfferSummaryDTO } from "@/contracts/offers";
import { OfferSchema, OfferSummarySchema } from "@/contracts/offers";
import { milestoneActions, milestoneIsPending, offerActions, offerIsPending } from "@/contracts/permissions";
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

function escrowLegs(milestone: OfferDocument["milestones"][number], currency: string): EscrowLegDTO[] {
  const escrow = milestone.escrow;
  if (!escrow) return [];
  const legs: EscrowLegDTO[] = [];
  if (escrow.sellerSplit) {
    legs.push({
      kind: "FUNDS_SPLIT",
      share: "SELLER",
      airwallexId: escrow.sellerSplit.splitId,
      amount: money(escrow.sellerSplit.amountMinor, currency),
      status: escrow.sellerSplit.status,
    });
  }
  if (escrow.revenueSplit) {
    legs.push({
      kind: "FUNDS_SPLIT",
      share: "REVENUE",
      airwallexId: escrow.revenueSplit.splitId,
      amount: money(escrow.revenueSplit.amountMinor, currency),
      status: escrow.revenueSplit.status,
    });
  }
  if (escrow.sellerTransfer) {
    legs.push({
      kind: "CA_TRANSFER",
      share: "SELLER",
      airwallexId: escrow.sellerTransfer.transferId,
      amount: money(escrow.sellerTransfer.amountMinor, currency),
      status: escrow.sellerTransfer.status,
    });
  }
  if (escrow.revenueTransfer) {
    legs.push({
      kind: "CA_TRANSFER",
      share: "REVENUE",
      airwallexId: escrow.revenueTransfer.transferId,
      amount: money(escrow.revenueTransfer.amountMinor, currency),
      status: escrow.revenueTransfer.status,
    });
  }
  if (escrow.refund) {
    legs.push({
      kind: "REFUND",
      share: "BUYER_REFUND",
      airwallexId: escrow.refund.refundId,
      amount: money(milestone.amountMinor, currency),
      status: escrow.refund.status,
    });
  }
  if (escrow.refundTransfer) {
    legs.push({
      kind: "CA_TRANSFER",
      share: "BUYER_REFUND",
      airwallexId: escrow.refundTransfer.transferId,
      amount: money(escrow.refundTransfer.amountMinor, currency),
      status: escrow.refundTransfer.status,
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

export function toOffer(offer: OfferDocument, viewerId: string, seller: UserDocument, buyer: UserDocument): OfferDTO {
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
      escrowLegs: escrowLegs(milestone, currency),
      allowedActions: milestoneActions(milestone, offer, viewerRole),
      approvedAt: iso(milestone.approvedAt),
      paidAt: iso(milestone.paidAt),
      refundedAt: iso(milestone.refundedAt),
    })),
    allowedActions: offerActions(offer, viewerRole),
    isPending: offerIsPending(offer),
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
