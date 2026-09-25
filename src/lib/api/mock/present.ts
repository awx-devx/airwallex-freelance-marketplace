import type { ActivityItemDTO, AirwallexEventDTO } from "@/contracts/activity";
import type { OfferDTO, OfferSummaryDTO } from "@/contracts/offers";
import { milestoneActions, milestoneIsPending, offerActions, offerIsPending } from "@/contracts/permissions";
import type { MeDTO, UserSummaryDTO } from "@/contracts/users";
import type { MockMilestone, MockOffer, MockUser } from "@/lib/api/mock/types";

export const USD = "USD";

export function money(amountMinor: number) {
  return { amountMinor, currency: USD };
}

export function toUserSummary(user: MockUser): UserSummaryDTO {
  return {
    id: user.id,
    name: user.name,
    headline: user.headline,
    avatarColor: user.avatarColor,
    initials: user.initials,
  };
}

export function toMe(user: MockUser, isGuest: boolean): MeDTO {
  return {
    ...toUserSummary(user),
    email: user.email,
    kind: user.kind === "REVENUE" ? "SEED" : user.kind,
    isGuest,
    airwallex: {
      accountId: user.airwallex.accountId,
      accountStatus: user.airwallex.accountStatus,
    },
    provisioning: { step: user.provisioning.step, error: user.provisioning.error },
  };
}

function role(offer: MockOffer, userId: string) {
  return offer.buyerId === userId ? "BUYER" : "SELLER";
}

function milestoneDto(offer: MockOffer, milestone: MockMilestone, userId: string) {
  const viewerRole = role(offer, userId);
  return {
    id: milestone.id,
    index: milestone.index,
    title: milestone.title,
    description: milestone.description,
    dueDate: milestone.dueDate,
    amount: money(milestone.amountMinor),
    breakdown: {
      seller: money(milestone.breakdown.sellerMinor),
      revenue: money(milestone.breakdown.revenueMinor),
      reserve: money(milestone.breakdown.reserveMinor),
      fee: money(milestone.breakdown.feeMinor),
    },
    status: milestone.status,
    isPending: milestoneIsPending(milestone.status),
    deliveries: milestone.deliveries,
    escrowLegs: milestone.escrowLegs,
    allowedActions: milestoneActions(milestone, offer, viewerRole),
    approvedAt: milestone.approvedAt,
    paidAt: milestone.paidAt,
    refundedAt: milestone.refundedAt,
    lastError: milestone.lastError,
  };
}

const HELD = new Set(["FUNDED", "SUBMITTED", "CHANGES_REQUESTED", "RELEASING", "RELEASE_FAILED"]);

export function toOffer(offer: MockOffer, userId: string, users: MockUser[]): OfferDTO {
  const seller = users.find((user) => user.id === offer.sellerId);
  const buyer = users.find((user) => user.id === offer.buyerId);
  if (!seller || !buyer) throw new Error("Offer is missing a party");
  const viewerRole = role(offer, userId);
  const milestones = offer.milestones.map((milestone) => milestoneDto(offer, milestone, userId));
  const sum = (pick: (milestone: MockMilestone) => boolean) =>
    offer.milestones.filter(pick).reduce((total, milestone) => total + milestone.amountMinor, 0);
  const feeSum = offer.milestones.reduce(
    (total, milestone) => ({
      sellerMinor: total.sellerMinor + milestone.breakdown.sellerMinor,
      revenueMinor: total.revenueMinor + milestone.breakdown.revenueMinor,
      reserveMinor: total.reserveMinor + milestone.breakdown.reserveMinor,
      feeMinor: total.feeMinor + milestone.breakdown.feeMinor,
    }),
    { sellerMinor: 0, revenueMinor: 0, reserveMinor: 0, feeMinor: 0 },
  );
  const counts: OfferDTO["milestoneCounts"] = {};
  for (const milestone of offer.milestones) {
    counts[milestone.status] = (counts[milestone.status] ?? 0) + 1;
  }

  return {
    id: offer.id,
    shortRef: offer.shortRef,
    title: offer.title,
    description: offer.description,
    status: offer.status,
    viewerRole,
    seller: toUserSummary(seller),
    buyer: toUserSummary(buyer),
    total: money(sum(() => true)),
    released: money(sum((milestone) => milestone.status === "PAID")),
    refunded: money(sum((milestone) => milestone.status === "REFUNDED")),
    milestoneCount: offer.milestones.length,
    milestoneCounts: counts,
    nextAction: nextAction(offer, viewerRole),
    isWelcomeOffer: offer.isWelcomeOffer,
    sentAt: offer.sentAt,
    updatedAt: offer.updatedAt,
    fundingRail: offer.fundingRail,
    feeSnapshot: offer.feeSnapshot,
    totals: {
      held: money(sum((milestone) => HELD.has(milestone.status))),
      released: money(sum((milestone) => milestone.status === "PAID")),
      refunded: money(sum((milestone) => milestone.status === "REFUNDED")),
      fees: {
        seller: money(feeSum.sellerMinor),
        revenue: money(feeSum.revenueMinor),
        reserve: money(feeSum.reserveMinor),
        fee: money(feeSum.feeMinor),
      },
    },
    milestones,
    allowedActions: offerActions(offer, viewerRole),
    isPending: offerIsPending(offer),
    payment: offer.payment
      ? {
          rail: offer.payment.rail,
          status: offer.payment.status,
          paymentIntentId: offer.payment.paymentIntentId,
          chargeId: offer.payment.chargeId,
        }
      : undefined,
    acceptedAt: offer.acceptedAt,
    fundedAt: offer.fundedAt,
    completedAt: offer.completedAt,
  };
}

function nextAction(offer: MockOffer, viewerRole: "BUYER" | "SELLER"): OfferDTO["nextAction"] {
  if (viewerRole === "BUYER" && offer.status === "SENT") return { label: "Review offer" };
  if (viewerRole === "BUYER" && offer.status === "AWAITING_PAYMENT") return { label: "Continue payment" };
  if (viewerRole === "BUYER") {
    const submitted = offer.milestones.find((milestone) => milestone.status === "SUBMITTED");
    if (submitted) return { label: `Review delivery for Milestone ${submitted.index + 1}`, milestoneId: submitted.id };
  }
  if (viewerRole === "SELLER") {
    const deliver = offer.milestones.find(
      (milestone) => milestone.status === "FUNDED" || milestone.status === "CHANGES_REQUESTED",
    );
    if (deliver) return { label: `Deliver Milestone ${deliver.index + 1}`, milestoneId: deliver.id };
  }
  return undefined;
}

export function toSummary(offer: MockOffer, userId: string, users: MockUser[]): OfferSummaryDTO {
  const full = toOffer(offer, userId, users);
  const counterparty = full.viewerRole === "BUYER" ? full.seller : full.buyer;
  return {
    id: full.id,
    shortRef: full.shortRef,
    title: full.title,
    status: full.status,
    viewerRole: full.viewerRole,
    counterparty,
    total: full.total,
    released: full.released,
    refunded: full.refunded,
    milestoneCount: full.milestoneCount,
    milestoneCounts: full.milestoneCounts,
    nextAction: full.nextAction,
    isWelcomeOffer: full.isWelcomeOffer,
    sentAt: full.sentAt,
    updatedAt: full.updatedAt,
  };
}

export function publicActivity(item: ActivityItemDTO): ActivityItemDTO {
  return {
    id: item.id,
    type: item.type,
    message: item.message,
    actor: item.actor,
    milestoneId: item.milestoneId,
    createdAt: item.createdAt,
  };
}

export function publicEvent(event: AirwallexEventDTO): AirwallexEventDTO {
  if (event.source === "API_CALL") {
    return {
      id: event.id,
      source: "API_CALL",
      at: event.at,
      method: event.method,
      path: event.path,
      status: event.status,
      durationMs: event.durationMs,
      onBehalfOf: event.onBehalfOf,
      requestBody: event.requestBody,
      responseBody: event.responseBody,
      errorCode: event.errorCode,
    };
  }
  return {
    id: event.id,
    source: "WEBHOOK",
    at: event.at,
    name: event.name,
    objectId: event.objectId,
    processed: event.processed,
    processingError: event.processingError,
    payload: event.payload,
  };
}
