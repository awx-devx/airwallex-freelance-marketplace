import type { AirwallexEventDTO, ActivityItemDTO } from "@/contracts/activity";
import type { ReleaseLegDTO, MilestoneStatus, OfferStatus } from "@/contracts/offers";
import type { ProvisioningStep } from "@/contracts/users";
import type { TransactionDTO } from "@/contracts/wallet";

export type DemoRole = "Seller" | "Buyer" | "Both";

export type MockUser = {
  id: string;
  email: string;
  password: string;
  name: string;
  headline?: string;
  avatarColor: string;
  initials: string;
  kind: "REGULAR" | "SEED" | "REVENUE";
  isGuestPool: boolean;
  demoRole?: DemoRole;
  airwallex: {
    accountId?: string;
    accountStatus?: "CREATED" | "SUBMITTED" | "ACTIVE" | "ACTION_REQUIRED" | "SUSPENDED";
  };
  provisioning: { step: ProvisioningStep; error?: string };
  availableMinor: number;
  pendingMinor: number;
  reservedMinor: number;
};

export type MockDelivery = {
  id: string;
  links: string[];
  note?: string;
  submittedAt: string;
  review?: { decision: "APPROVED" | "CHANGES_REQUESTED"; comment?: string; reviewedAt: string };
};

export type MockMilestone = {
  id: string;
  index: number;
  title: string;
  description?: string;
  dueDate?: string;
  amountMinor: number;
  breakdown: { sellerMinor: number; revenueMinor: number; reserveMinor: number; feeMinor: number };
  status: MilestoneStatus;
  deliveries: MockDelivery[];
  releaseLegs: ReleaseLegDTO[];
  approvedAt?: string;
  paidAt?: string;
  refundedAt?: string;
  lastError?: string;
  pendingSince?: string;
};

export type MockPayment = {
  rail: "CARD" | "WALLET";
  status: "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
  attempt: number;
  paymentIntentId?: string;
  clientSecret?: string;
  chargeId?: string;
  cardOutcome?: "success" | "decline";
};

export type MockOffer = {
  id: string;
  shortRef: string;
  seedKey?: string;
  sellerId: string;
  buyerId: string;
  title: string;
  description: string;
  status: OfferStatus;
  fundingRail?: "CARD" | "WALLET";
  feeSnapshot: { platformFeePercent: number; processingReservePercent: number };
  isWelcomeOffer: boolean;
  milestones: MockMilestone[];
  payment?: MockPayment;
  sentAt: string;
  updatedAt: string;
  acceptedAt?: string;
  fundedAt?: string;
  completedAt?: string;
};

export type MockActivity = ActivityItemDTO & { offerId: string };
export type MockEvent = AirwallexEventDTO & { offerId: string };
export type MockTxn = TransactionDTO & { userId: string };

export type ScenarioId = "fresh-seed" | "empty-new-user" | "everything-pending" | "errors";

export type MockFault = {
  pathIncludes: string;
  times: number;
  status: number;
  code: string;
  message: string;
  airwallex?: { code?: string; traceId?: string };
};

export type MockDb = {
  users: MockUser[];
  offers: MockOffer[];
  activity: MockActivity[];
  events: MockEvent[];
  transactions: MockTxn[];
  sessionUserId?: string;
  sessionIsGuest?: boolean;
  platformAvailableMinor: number;
  scenario: ScenarioId;
};
