import type { ActivityItemDTO, AirwallexEventDTO } from "@/contracts/activity";
import type { MoneyDTO } from "@/contracts/common";
import { MilestoneStatusSchema, type MilestoneDTO, type MilestoneStatus, type OfferDTO, type OfferStatus, type OfferSummaryDTO, type ViewerRole } from "@/contracts/offers";
import { milestoneActions, milestoneIsPending, offerActions, offerIsPending } from "@/contracts/permissions";
import type { ProvisioningStep } from "@/contracts/users";
import type { BalanceDTO, TransactionDTO } from "@/contracts/wallet";
import { createSeedDb } from "@/lib/api/mock/fixtures";
import { money, toOffer, toSummary, toUserSummary } from "@/lib/api/mock/present";

const db = createSeedDb();

export function seedUser(id: string) {
  const user = db.users.find((item) => item.id === id);
  if (!user) throw new Error(`Missing ${id}`);
  return toUserSummary(user);
}

export function seedOffer(id: string, userId: string, status?: OfferStatus): OfferDTO {
  const stored = db.offers.find((item) => item.id === id);
  if (!stored) throw new Error(`Missing ${id}`);
  const offer = toOffer(stored, userId, db.users);
  if (!status || status === offer.status) return offer;
  const next = { ...offer, status };
  next.allowedActions = offerActions(next, next.viewerRole);
  next.isPending = offerIsPending(next);
  return next;
}

export function seedSummary(id: string, userId: string): OfferSummaryDTO {
  const stored = db.offers.find((item) => item.id === id);
  if (!stored) throw new Error(`Missing ${id}`);
  return toSummary(stored, userId, db.users);
}

export const welcomeOffer: OfferSummaryDTO = {
  ...seedSummary("off_coffee", "usr_sam"),
  id: "off_welcome",
  title: "Logo design",
  isWelcomeOffer: true,
  nextAction: { label: "Review offer" },
};

const OFFER_STATUSES: OfferStatus[] = ["SENT", "AWAITING_PAYMENT", "ACTIVE", "COMPLETED", "CANCELLED", "DECLINED", "WITHDRAWN"];

export function offerHeaders(role: ViewerRole): OfferDTO[] {
  const userId = role === "BUYER" ? "usr_hannah" : "usr_maya";
  return OFFER_STATUSES.map((status) => seedOffer("off_social", userId, status));
}

export function milestoneFor(status: MilestoneStatus, role: ViewerRole, extra: Partial<MilestoneDTO> = {}): MilestoneDTO {
  const offer = seedOffer("off_social", role === "BUYER" ? "usr_hannah" : "usr_maya");
  const base = offer.milestones[0];
  if (!base) throw new Error("Missing milestone");
  const paid = seedOffer("off_shopify", "usr_sam").milestones[0];
  const refunded = seedOffer("off_icon", "usr_maya").milestones[0];
  const submitted = base.deliveries[0];
  const deliveries =
    status === "CHANGES_REQUESTED" && submitted
      ? [
          {
            ...submitted,
            review: {
              decision: "CHANGES_REQUESTED" as const,
              comment: "Tighten the spacing on page 2.",
              reviewedAt: "2026-09-24T18:00:00.000Z",
            },
          },
        ]
      : status === "SUBMITTED" || status === "PAID"
        ? base.deliveries
        : [];
  const milestone: MilestoneDTO = {
    ...base,
    ...extra,
    status,
    isPending: milestoneIsPending(status),
    deliveries,
    releaseLegs: status === "PAID" ? (paid?.releaseLegs ?? []) : status === "REFUNDED" ? (refunded?.releaseLegs ?? []) : [],
    paidAt: status === "PAID" ? "2026-09-23T15:00:00.000Z" : undefined,
    refundedAt: status === "REFUNDED" ? "2026-09-19T15:00:00.000Z" : undefined,
    lastError:
      extra.lastError ??
      (status === "RELEASE_FAILED" || status === "REFUND_FAILED" ? "Airwallex rejected the operation." : undefined),
    allowedActions: [],
  };
  milestone.allowedActions = milestoneActions(milestone, { status: "ACTIVE", milestones: offer.milestones }, role);
  return milestone;
}

export const MILESTONE_STATUSES = MilestoneStatusSchema.options;

export const sampleActivity: ActivityItemDTO[] = [
  {
    id: "act_sent",
    type: "OFFER_SENT",
    message: "Sent the offer",
    actor: seedUser("usr_maya"),
    createdAt: "2026-09-20T15:00:00.000Z",
  },
  {
    id: "act_delivery",
    type: "DELIVERY_SUBMITTED",
    message: "Submitted delivery for Milestone 1",
    actor: seedUser("usr_maya"),
    milestoneId: "off_social_m0",
    createdAt: "2026-09-24T16:00:00.000Z",
  },
];

export const sampleEvents: AirwallexEventDTO[] = [
  {
    id: "evt_charge",
    source: "API_CALL",
    at: "2026-09-22T12:00:00.000Z",
    method: "POST",
    path: "/api/v1/charges/create",
    status: 201,
    durationMs: 180,
    responseBody: { id: "ch_mock_social", status: "SETTLED" },
  },
  {
    id: "evt_release_open",
    source: "API_CALL",
    at: "2026-09-25T12:00:00.000Z",
    method: "POST",
    path: "/api/v1/funds_splits/release",
    status: 400,
    durationMs: 90,
    errorCode: "invalid_status_for_operation",
    responseBody: { code: "invalid_status_for_operation", trace_id: "tr_9f3a" },
  },
  {
    id: "evt_webhook",
    source: "WEBHOOK",
    at: "2026-09-22T12:00:02.000Z",
    name: "charge.settled",
    objectId: "ch_mock_social",
    processed: true,
    payload: { id: "evt_mock_social", name: "charge.settled" },
  },
  {
    id: "evt_webhook_failed",
    source: "WEBHOOK",
    at: "2026-09-25T12:01:00.000Z",
    name: "funds_split.failed",
    objectId: "spt_mock_social",
    processed: false,
    processingError: "Unknown split",
    payload: { name: "funds_split.failed" },
  },
];

const usd = (amountMinor: number): MoneyDTO => money(amountMinor);

export const sampleBalance: BalanceDTO = {
  currency: "USD",
  available: usd(2_350_000),
  pending: usd(40_000),
  reserved: usd(0),
  total: usd(2_390_000),
};

export const sampleTransactions: TransactionDTO[] = [
  { id: "txn_in", at: "2026-09-23T15:00:00.000Z", type: "TRANSFER_IN", label: "Milestone released", amount: usd(36_000) },
  { id: "txn_out", at: "2026-09-22T12:00:00.000Z", type: "CHARGE", label: "Funded Coffee brand identity", amount: usd(-150_000) },
];

export const testCards = [
  { number: "4035 5010 0000 0008", label: "Succeeds", outcome: "success" as const },
  { number: "4012 0003 0000 1003", label: "Declines", outcome: "decline" as const },
];

export const provisioningSteps: ProvisioningStep[] = ["NONE", "ACCOUNT_CREATED", "SUBMITTED", "ACTIVE", "WELCOME_CREDITED", "READY", "FAILED"];

export const legSamples = [
  { kind: "FUNDS_SPLIT" as const, share: "SELLER" as const, airwallexId: "spt_mock_seller", amount: usd(36_000), status: "CREATED" },
  { kind: "CA_TRANSFER" as const, share: "REVENUE" as const, airwallexId: "tr_mock_rev", amount: usd(3_200), status: "SETTLED" },
  { kind: "REFUND" as const, share: "BUYER_REFUND" as const, airwallexId: "rfd_mock_icon", amount: usd(45_000), status: "SETTLED" },
];

export const payeeName = "Maya Chen";
