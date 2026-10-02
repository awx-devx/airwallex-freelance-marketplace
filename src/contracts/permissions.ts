import type { MilestoneAction, MilestoneStatus, OfferAction, OfferStatus, ViewerRole } from "@/contracts/offers";

const UNRELEASED: ReadonlySet<MilestoneStatus> = new Set(["FUNDED", "SUBMITTED", "CHANGES_REQUESTED"]);

const OFFER_ACTION_ORDER: readonly OfferAction[] = [
  "ACCEPT_AND_PAY",
  "DECLINE",
  "WITHDRAW",
  "CONTINUE_PAYMENT",
  "CANCEL_PAYMENT",
  "CANCEL_REMAINING",
];

const MILESTONE_ACTION_ORDER: readonly MilestoneAction[] = [
  "SUBMIT_DELIVERY",
  "APPROVE",
  "REQUEST_CHANGES",
  "CANCEL",
  "RETRY",
];

export type OfferPermissionInput = {
  status: OfferStatus;
  milestones: ReadonlyArray<{ status: MilestoneStatus }>;
};

export type MilestonePermissionInput = {
  status: MilestoneStatus;
  index: number;
  lastError?: string;
};

export type MilestoneOfferInput = {
  status: OfferStatus;
  milestones: ReadonlyArray<{ status: MilestoneStatus; index: number }>;
};

export type MilestoneActionOptions = {
  /** When true, delivery requires the previous milestone to be PAID. Default false. */
  sequential?: boolean;
};

function ordered<T extends string>(order: readonly T[], selected: ReadonlySet<T>): T[] {
  return order.filter((action) => selected.has(action));
}

export function milestoneIsPending(status: MilestoneStatus): boolean {
  return status === "RELEASING" || status === "REFUNDING";
}

const ACCEPTED_SPLIT = new Set(["RELEASED", "SETTLED"]);

/** Card release has been accepted. Settlement to the wallet can still take a day. */
export function cardReleaseAccepted(milestone: {
  status: MilestoneStatus;
  releaseLegs: ReadonlyArray<{ kind: string; share: string; status: string }>;
}): boolean {
  if (milestone.status !== "RELEASING") return false;
  const splits = milestone.releaseLegs.filter(
    (leg) => leg.kind === "FUNDS_SPLIT" && (leg.share === "SELLER" || leg.share === "REVENUE"),
  );
  return splits.some((leg) => leg.share === "SELLER") && splits.every((leg) => ACCEPTED_SPLIT.has(leg.status));
}

export function offerIsPending(offer: OfferPermissionInput): boolean {
  return offer.status === "AWAITING_PAYMENT" || offer.milestones.some((milestone) => milestoneIsPending(milestone.status));
}

function hasUnreleasedMilestone(offer: OfferPermissionInput): boolean {
  return offer.milestones.some((milestone) => UNRELEASED.has(milestone.status));
}

/** docs/04 state machines and docs/05 role rules. Shared by DTO mappers and mocks. */
export function offerActions(offer: OfferPermissionInput, viewerRole: ViewerRole): OfferAction[] {
  const actions = new Set<OfferAction>();

  if (offer.status === "SENT" && viewerRole === "BUYER") {
    actions.add("ACCEPT_AND_PAY");
    actions.add("DECLINE");
  }
  if (offer.status === "SENT" && viewerRole === "SELLER") {
    actions.add("WITHDRAW");
  }
  if (offer.status === "AWAITING_PAYMENT" && viewerRole === "BUYER") {
    actions.add("CONTINUE_PAYMENT");
    actions.add("CANCEL_PAYMENT");
  }
  if (offer.status === "ACTIVE" && hasUnreleasedMilestone(offer)) {
    actions.add("CANCEL_REMAINING");
  }

  return ordered(OFFER_ACTION_ORDER, actions);
}

function previousIsPaid(milestone: MilestonePermissionInput, offer: MilestoneOfferInput): boolean {
  if (milestone.index === 0) return true;
  const previous = offer.milestones.find((item) => item.index === milestone.index - 1);
  return previous?.status === "PAID";
}

/** docs/04 milestone machine. Either party can cancel an unreleased milestone. */
export function milestoneActions(
  milestone: MilestonePermissionInput,
  offer: MilestoneOfferInput,
  viewerRole: ViewerRole,
  options: MilestoneActionOptions = {},
): MilestoneAction[] {
  if (offer.status !== "ACTIVE") return [];

  const actions = new Set<MilestoneAction>();
  const failed = milestone.status === "RELEASE_FAILED" || milestone.status === "REFUND_FAILED";
  const stuckPending = milestoneIsPending(milestone.status) && Boolean(milestone.lastError);

  if (failed || stuckPending) {
    actions.add("RETRY");
  }

  if (UNRELEASED.has(milestone.status)) {
    actions.add("CANCEL");
  }

  const canDeliver =
    (milestone.status === "FUNDED" || milestone.status === "CHANGES_REQUESTED") &&
    viewerRole === "SELLER" &&
    (!options.sequential || previousIsPaid(milestone, offer));

  if (canDeliver) {
    actions.add("SUBMIT_DELIVERY");
  }

  if (milestone.status === "SUBMITTED" && viewerRole === "BUYER") {
    actions.add("APPROVE");
    actions.add("REQUEST_CHANGES");
  }

  return ordered(MILESTONE_ACTION_ORDER, actions);
}
