import { ZodError, type ZodType } from "zod";
import type { ReleaseLegDTO, OfferAction, MilestoneAction } from "@/contracts/offers";
import {
  CancelReasonInputSchema,
  CreateOfferInputSchema,
  RequestChangesInputSchema,
  SubmitDeliveryInputSchema,
} from "@/contracts/offers";
import { milestoneActions, offerActions } from "@/contracts/permissions";
import { LoginInputSchema, SignupInputSchema, UserSearchQuerySchema, type ProvisioningStep } from "@/contracts/users";
import { SendFundsInputSchema, WithdrawalInputSchema, type TransactionDTO } from "@/contracts/wallet";
import { ApiError } from "@/lib/api/errors";
import { commit, getDb, nextId, nowIso } from "@/lib/api/mock/db";
import { WELCOME_TEMPLATES } from "@/lib/api/mock/fixtures";
import { money, toMe, toOffer, toSummary, toUserSummary } from "@/lib/api/mock/present";
import { scheduleMockJob, SETTLE_MS } from "@/lib/api/mock/simulate";
import type { MockMilestone, MockOffer, MockUser } from "@/lib/api/mock/types";
import { breakdown } from "@/services/fees";
import { fromAwxAmount } from "@/lib/money";
import { publicConfig as envConfig } from "@/lib/config.public";

const FEE = { platformFeePercent: 10, processingReservePercent: 2 };
const STEPS: ProvisioningStep[] = ["ACCOUNT_CREATED", "SUBMITTED", "ACTIVE", "WELCOME_CREDITED", "READY"];
const provisioningUsers = new Set<string>();

function without<T extends object, K extends keyof T>(value: T, key: K): Omit<T, K> {
  const next = { ...value };
  Reflect.deleteProperty(next, key);
  return next;
}

function fail(status: number, code: string, message: string, fieldErrors?: Record<string, string[]>): never {
  throw new ApiError({ status, code, message, fieldErrors });
}

function fieldErrors(error: ZodError) {
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".");
    errors[path] ??= [];
    errors[path].push(issue.message);
  }
  return errors;
}

function parse<T>(schema: ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) fail(422, "VALIDATION_FAILED", "Check the highlighted fields.", fieldErrors(parsed.error));
  return parsed.data;
}

function requireUser() {
  const db = getDb();
  const user = db.users.find((item) => item.id === db.sessionUserId);
  if (!user) fail(401, "UNAUTHENTICATED", "Sign in to continue.");
  return user;
}

function requireReady(user: MockUser) {
  if (user.provisioning.step !== "READY") {
    fail(409, "PROVISIONING_INCOMPLETE", "Finish setting up your account first.");
  }
}

function requireOffer(id: string, user: MockUser) {
  const offer = getDb().offers.find((item) => item.id === id);
  if (!offer) fail(404, "NOT_FOUND", "Offer not found.");
  if (offer.buyerId !== user.id && offer.sellerId !== user.id) {
    fail(403, "FORBIDDEN", "You're not part of this offer.");
  }
  return offer;
}

function viewerRole(offer: MockOffer, user: MockUser) {
  return offer.buyerId === user.id ? "BUYER" : "SELLER";
}

function assertOffer(offer: MockOffer, user: MockUser, action: OfferAction) {
  if (!offerActions(offer, viewerRole(offer, user)).includes(action)) {
    fail(409, "INVALID_STATE", "That action isn't available.");
  }
}

function assertMilestone(offer: MockOffer, milestone: MockMilestone, user: MockUser, action: MilestoneAction) {
  if (!milestoneActions(milestone, offer, viewerRole(offer, user)).includes(action)) {
    fail(409, "INVALID_STATE", "That action isn't available.");
  }
}

function touch(offer: MockOffer) {
  offer.updatedAt = nowIso();
  commit();
}

function userById(id: string) {
  const user = getDb().users.find((item) => item.id === id);
  if (!user) fail(404, "NOT_FOUND", "User not found.");
  return user;
}

function activity(offer: MockOffer, type: string, message: string, actor?: MockUser, milestoneId?: string) {
  getDb().activity.push({
    id: nextId("act"),
    offerId: offer.id,
    type,
    message,
    actor: actor ? toUserSummary(actor) : undefined,
    milestoneId,
    createdAt: nowIso(),
  });
}

function eventApi(offerId: string, method: string, path: string, responseBody: unknown) {
  getDb().events.push({
    id: nextId("evt"),
    offerId,
    source: "API_CALL",
    at: nowIso(),
    method,
    path,
    status: 201,
    durationMs: 160,
    responseBody,
  });
}

function eventHook(offerId: string, name: string, objectId: string) {
  getDb().events.push({
    id: nextId("evt"),
    offerId,
    source: "WEBHOOK",
    at: nowIso(),
    name,
    objectId,
    processed: true,
    payload: { id: nextId("wh"), name, data: { id: objectId } },
  });
}

function txn(userId: string, type: TransactionDTO["type"], label: string, amountMinor: number, reference?: string) {
  getDb().transactions.push({
    id: nextId("txn"),
    userId,
    at: nowIso(),
    type,
    label,
    amount: money(amountMinor),
    reference,
  });
}

function totalMinor(offer: MockOffer) {
  return offer.milestones.reduce((sum, milestone) => sum + milestone.amountMinor, 0);
}

function maybeComplete(offer: MockOffer) {
  const statuses = offer.milestones.map((milestone) => milestone.status);
  if (!statuses.every((status) => status === "PAID" || status === "REFUNDED")) return;
  if (statuses.every((status) => status === "REFUNDED")) {
    offer.status = "CANCELLED";
    return;
  }
  if (statuses.some((status) => status === "PAID")) {
    offer.status = "COMPLETED";
    offer.completedAt = nowIso();
  }
}

function cardLegs(milestone: MockMilestone): ReleaseLegDTO[] {
  return [
    {
      kind: "FUNDS_SPLIT",
      share: "SELLER",
      airwallexId: `spt_mock_${milestone.id}_seller`,
      amount: money(milestone.breakdown.sellerMinor),
      status: "CREATED",
    },
    {
      kind: "FUNDS_SPLIT",
      share: "REVENUE",
      airwallexId: `spt_mock_${milestone.id}_rev`,
      amount: money(milestone.breakdown.revenueMinor),
      status: "CREATED",
    },
  ];
}

function fundOffer(offer: MockOffer, rail: "CARD" | "WALLET") {
  if (offer.status === "ACTIVE") return;
  offer.status = "ACTIVE";
  offer.fundingRail = rail;
  offer.fundedAt = nowIso();
  offer.updatedAt = nowIso();
  offer.acceptedAt ??= nowIso();
  if (offer.payment) offer.payment.status = "SUCCEEDED";
  for (const milestone of offer.milestones) {
    if (milestone.status !== "PENDING_FUNDING") continue;
    milestone.status = "FUNDED";
    if (rail === "CARD") milestone.releaseLegs = cardLegs(milestone);
  }
  activity(offer, "PAYMENT_SUCCEEDED", rail === "CARD" ? "Payment received by card" : "Payment received from wallet");
  activity(offer, "SPLITS_CREATED", rail === "CARD" ? "Funds awaiting release" : "Wallet payment held by the platform");
  commit();
}

function settleRelease(offerId: string, milestoneId: string) {
  const db = getDb();
  const offer = db.offers.find((item) => item.id === offerId);
  const milestone = offer?.milestones.find((item) => item.id === milestoneId);
  if (!offer || !milestone || milestone.status !== "RELEASING") return;
  const rail = offer.fundingRail ?? "CARD";
  if (milestone.releaseLegs.length === 0) {
    milestone.releaseLegs =
      rail === "CARD"
        ? cardLegs(milestone)
        : [
            {
              kind: "CA_TRANSFER",
              share: "SELLER",
              airwallexId: `tr_mock_${milestone.id}_seller`,
              amount: money(milestone.breakdown.sellerMinor),
              status: "SETTLED",
            },
            {
              kind: "CA_TRANSFER",
              share: "REVENUE",
              airwallexId: `tr_mock_${milestone.id}_rev`,
              amount: money(milestone.breakdown.revenueMinor),
              status: "SETTLED",
            },
          ];
  }
  for (const leg of milestone.releaseLegs) leg.status = "SETTLED";
  milestone.status = "PAID";
  milestone.paidAt = nowIso();
  milestone.pendingSince = undefined;
  milestone.lastError = undefined;
  const seller = userById(offer.sellerId);
  const revenue = db.users.find((user) => user.kind === "REVENUE");
  seller.availableMinor += milestone.breakdown.sellerMinor;
  if (revenue) revenue.availableMinor += milestone.breakdown.revenueMinor;
  db.platformAvailableMinor += milestone.breakdown.reserveMinor;
  txn(seller.id, "TRANSFER_IN", `Milestone payment: ${milestone.title}`, milestone.breakdown.sellerMinor, offer.shortRef);
  activity(offer, "MILESTONE_PAID", `${milestone.title} paid`, undefined, milestone.id);
  eventHook(offer.id, rail === "CARD" ? "funds_split.settled" : "connected_account_transfer.settled", milestone.releaseLegs[0]?.airwallexId ?? milestone.id);
  maybeComplete(offer);
  touch(offer);
}

function settleRefund(offerId: string, milestoneId: string) {
  const offer = getDb().offers.find((item) => item.id === offerId);
  const milestone = offer?.milestones.find((item) => item.id === milestoneId);
  if (!offer || !milestone || milestone.status !== "REFUNDING") return;
  milestone.status = "REFUNDED";
  milestone.refundedAt = nowIso();
  milestone.pendingSince = undefined;
  milestone.lastError = undefined;
  milestone.releaseLegs.push({
    kind: "REFUND",
    share: "BUYER_REFUND",
    airwallexId: `rfd_mock_${milestone.id}`,
    amount: money(milestone.amountMinor),
    status: "SETTLED",
  });
  if (offer.fundingRail === "WALLET") {
    const buyer = userById(offer.buyerId);
    buyer.availableMinor += milestone.amountMinor;
    txn(buyer.id, "TRANSFER_IN", `Refund: ${milestone.title}`, milestone.amountMinor, offer.shortRef);
  }
  activity(offer, "MILESTONE_REFUNDED", `${milestone.title} refunded`, undefined, milestone.id);
  eventHook(offer.id, "refund.settled", `rfd_mock_${milestone.id}`);
  maybeComplete(offer);
  touch(offer);
}

function scheduleRelease(offer: MockOffer, milestone: MockMilestone) {
  milestone.status = "RELEASING";
  milestone.pendingSince = nowIso();
  milestone.lastError = undefined;
  if ((offer.fundingRail ?? "CARD") === "CARD") {
    const legs = milestone.releaseLegs.length > 0 ? milestone.releaseLegs : cardLegs(milestone);
    milestone.releaseLegs = legs.map((leg) => (leg.kind === "FUNDS_SPLIT" ? { ...leg, status: "RELEASED" } : leg));
  }
  eventApi(offer.id, "POST", `/api/v1/pa/funds_splits/${milestone.id}/release`, { status: "RELEASED" });
  scheduleMockJob(() => settleRelease(offer.id, milestone.id), SETTLE_MS);
}

function scheduleRefund(offer: MockOffer, milestone: MockMilestone) {
  milestone.status = "REFUNDING";
  milestone.pendingSince = nowIso();
  milestone.lastError = undefined;
  eventApi(offer.id, "POST", "/api/v1/pa/refunds/create", { id: `rfd_mock_${milestone.id}`, status: "RECEIVED" });
  scheduleMockJob(() => settleRefund(offer.id, milestone.id), SETTLE_MS);
}

export function publicConfig() {
  return {
    currency: "USD",
    platformFeePercent: 10,
    processingReservePercent: 2,
    minMilestoneMinor: 1_000,
    maxOfferTotalMinor: 900_000,
    maxMilestones: 10,
    walletRailEnabled: true,
    airwallexEnv: envConfig.airwallexEnv,
    testCards: [
      { number: "4035501000000008", label: "Success", outcome: "success" as const },
      { number: "4012000300001003", label: "Decline", outcome: "decline" as const },
    ],
    mocksEnabled: true,
  };
}

export function demoAccounts() {
  return getDb()
    .users.filter((user) => user.kind === "SEED" && user.demoRole)
    .map((user) => ({ ...toUserSummary(user), email: user.email, role: user.demoRole! }));
}

export function signup(body: unknown) {
  const input = parse(SignupInputSchema, body);
  const email = input.email.toLowerCase();
  if (getDb().users.some((user) => user.email === email)) {
    fail(409, "EMAIL_TAKEN", "That email is already in use.", { email: ["That email is already in use."] });
  }
  const user: MockUser = {
    id: nextId("usr"),
    email,
    password: input.password,
    name: input.name,
    headline: input.headline,
    avatarColor: "#57534E",
    initials: input.name
      .split(" ")
      .slice(0, 2)
      .map((part) => part[0] ?? "")
      .join("")
      .toUpperCase(),
    kind: "REGULAR",
    isGuestPool: false,
    airwallex: {},
    provisioning: { step: "NONE" },
    availableMinor: 0,
    pendingMinor: 0,
    reservedMinor: 0,
  };
  getDb().users.push(user);
  getDb().sessionUserId = user.id;
  getDb().sessionIsGuest = false;
  commit();
  return toMe(user, false);
}

export function login(body: unknown) {
  const input = parse(LoginInputSchema, body);
  const user = getDb().users.find((item) => item.email === input.email.toLowerCase() && item.kind !== "REVENUE");
  if (!user || user.password !== input.password) fail(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
  getDb().sessionUserId = user.id;
  getDb().sessionIsGuest = false;
  commit();
  return toMe(user, false);
}

export function guest() {
  const pool = getDb().users.filter((user) => user.isGuestPool && user.provisioning.step === "READY");
  const user = pool[Math.floor(Math.random() * pool.length)];
  if (!user) fail(500, "INTERNAL", "No guest accounts are ready.");
  getDb().sessionUserId = user.id;
  getDb().sessionIsGuest = true;
  commit();
  return toMe(user, true);
}

export function logout() {
  getDb().sessionUserId = undefined;
  getDb().sessionIsGuest = false;
  commit();
  return { ok: true as const };
}

export function me() {
  return toMe(requireUser(), getDb().sessionIsGuest ?? false);
}

export function runProvisioning() {
  const user = requireUser();
  if (user.provisioning.step === "READY" || provisioningUsers.has(user.id)) return toMe(user, getDb().sessionIsGuest ?? false);
  provisioningUsers.add(user.id);
  const start = Math.max(0, STEPS.indexOf(user.provisioning.step as ProvisioningStep));
  const remaining = user.provisioning.step === "NONE" || user.provisioning.step === "FAILED" ? STEPS : STEPS.slice(start + 1);
  if (user.provisioning.step === "FAILED") user.provisioning.error = undefined;
  remaining.forEach((step, index) => {
    scheduleMockJob(() => applyProvisioningStep(user.id, step, index === remaining.length - 1), 400 * (index + 1));
  });
  commit();
  return toMe(user, getDb().sessionIsGuest ?? false);
}

function applyProvisioningStep(userId: string, step: ProvisioningStep, last: boolean) {
  const user = getDb().users.find((item) => item.id === userId);
  if (!user) return;
  user.provisioning.step = step;
  if (step === "ACCOUNT_CREATED") user.airwallex = { accountId: `acct_mock_${user.id}`, accountStatus: "CREATED" };
  if (step === "SUBMITTED") user.airwallex.accountStatus = "SUBMITTED";
  if (step === "ACTIVE") user.airwallex.accountStatus = "ACTIVE";
  if (step === "WELCOME_CREDITED" && user.availableMinor === 0) {
    user.availableMinor = 500_000;
    txn(user.id, "DEPOSIT", "Welcome credit", 500_000);
  }
  if (step === "READY") createWelcomeOffer(user);
  if (last) provisioningUsers.delete(user.id);
  commit();
}

function createWelcomeOffer(buyer: MockUser) {
  if (getDb().offers.some((offer) => offer.isWelcomeOffer && offer.buyerId === buyer.id)) return;
  const sellers = getDb().users.filter((user) => user.kind === "SEED" && user.demoRole !== "Buyer");
  const seller = sellers[Math.floor(Math.random() * sellers.length)];
  const template = WELCOME_TEMPLATES[Math.floor(Math.random() * WELCOME_TEMPLATES.length)];
  if (!seller || !template) return;
  insertOffer({
    sellerId: seller.id,
    buyerId: buyer.id,
    title: template.title,
    description: template.description,
    milestones: template.milestones.map((milestone) => ({ title: milestone.title, amount: milestone.amount })),
    isWelcomeOffer: true,
  });
}

function insertOffer(input: {
  sellerId: string;
  buyerId: string;
  title: string;
  description: string;
  milestones: Array<{ title: string; description?: string; amount: string; dueDate?: string }>;
  isWelcomeOffer?: boolean;
}) {
  const id = nextId("off");
  const offer: MockOffer = {
    id,
    shortRef: `OF-${id.slice(-4).toUpperCase()}`,
    sellerId: input.sellerId,
    buyerId: input.buyerId,
    title: input.title,
    description: input.description,
    status: "SENT",
    feeSnapshot: FEE,
    isWelcomeOffer: input.isWelcomeOffer ?? false,
    sentAt: nowIso(),
    updatedAt: nowIso(),
    milestones: input.milestones.map((milestone, index) => {
      const amountMinor = fromAwxAmount(milestone.amount, "USD");
      return {
        id: nextId("ms"),
        index,
        title: milestone.title,
        description: milestone.description,
        dueDate: milestone.dueDate,
        amountMinor,
        breakdown: breakdown(amountMinor, FEE),
        status: "PENDING_FUNDING",
        deliveries: [],
        releaseLegs: [],
      };
    }),
  };
  getDb().offers.unshift(offer);
  activity(offer, "OFFER_SENT", `${userById(input.sellerId).name} sent the offer`, userById(input.sellerId));
  commit();
  return offer;
}

export function searchUsers(query: Record<string, string | undefined> | undefined) {
  const { q } = parse(UserSearchQuerySchema, query);
  const self = requireUser();
  const needle = q.toLowerCase();
  return getDb()
    .users.filter(
      (user) =>
        user.id !== self.id &&
        user.kind !== "REVENUE" &&
        user.provisioning.step === "READY" &&
        (user.name.toLowerCase().includes(needle) || user.email.includes(needle)),
    )
    .slice(0, 10)
    .map(toUserSummary);
}

export function listOffers(view: string | undefined) {
  const user = requireUser();
  if (view !== "incoming" && view !== "buying" && view !== "selling") {
    fail(422, "VALIDATION_FAILED", "Choose a view.", { view: ["Choose incoming, buying, or selling."] });
  }
  return getDb()
    .offers.filter((offer) => {
      if (view === "selling") return offer.sellerId === user.id;
      if (offer.buyerId !== user.id) return false;
      if (view === "incoming") return offer.status === "SENT" || offer.status === "AWAITING_PAYMENT";
      return offer.status === "ACTIVE" || offer.status === "COMPLETED" || offer.status === "CANCELLED";
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((offer) => toSummary(offer, user.id, getDb().users));
}

export function getOffer(id: string) {
  const user = requireUser();
  return toOffer(requireOffer(id, user), user.id, getDb().users);
}

export function createOffer(body: unknown) {
  const user = requireUser();
  requireReady(user);
  const input = parse(CreateOfferInputSchema, body);
  const buyer = getDb().users.find((item) => item.id === input.buyerId);
  if (!buyer || buyer.kind === "REVENUE" || buyer.provisioning.step !== "READY") {
    fail(422, "VALIDATION_FAILED", "Choose a buyer who can receive offers.", { buyerId: ["Choose a buyer who can receive offers."] });
  }
  if (buyer.id === user.id) fail(422, "VALIDATION_FAILED", "You can't send an offer to yourself.", { buyerId: ["You can't send an offer to yourself."] });
  const offer = insertOffer({ ...input, sellerId: user.id, buyerId: buyer.id });
  return toOffer(offer, user.id, getDb().users);
}

export function declineOffer(id: string) {
  const user = requireUser();
  const offer = requireOffer(id, user);
  assertOffer(offer, user, "DECLINE");
  offer.status = "DECLINED";
  activity(offer, "OFFER_DECLINED", `${user.name} declined the offer`, user);
  touch(offer);
  return toOffer(offer, user.id, getDb().users);
}

export function withdrawOffer(id: string) {
  const user = requireUser();
  const offer = requireOffer(id, user);
  assertOffer(offer, user, "WITHDRAW");
  offer.status = "WITHDRAWN";
  activity(offer, "OFFER_WITHDRAWN", `${user.name} withdrew the offer`, user);
  touch(offer);
  return toOffer(offer, user.id, getDb().users);
}

export function cancelRemaining(id: string, body: unknown) {
  const user = requireUser();
  const offer = requireOffer(id, user);
  assertOffer(offer, user, "CANCEL_REMAINING");
  parse(CancelReasonInputSchema, body ?? {});
  for (const milestone of offer.milestones) {
    if (milestone.status === "FUNDED" || milestone.status === "SUBMITTED" || milestone.status === "CHANGES_REQUESTED") {
      scheduleRefund(offer, milestone);
    }
  }
  touch(offer);
  return toOffer(offer, user.id, getDb().users);
}

export function syncOffer(id: string) {
  return getOffer(id);
}

export function offerActivity(id: string) {
  const user = requireUser();
  requireOffer(id, user);
  return getDb()
    .activity.filter((item) => item.offerId === id)
    .map((item) => without(item, "offerId"));
}

export function offerEvents(id: string) {
  const user = requireUser();
  requireOffer(id, user);
  return getDb()
    .events.filter((item) => item.offerId === id)
    .map((item) => without(item, "offerId"));
}

export function submitDelivery(offerId: string, milestoneId: string, body: unknown) {
  const user = requireUser();
  const offer = requireOffer(offerId, user);
  const milestone = milestoneOr404(offer, milestoneId);
  assertMilestone(offer, milestone, user, "SUBMIT_DELIVERY");
  const input = parse(SubmitDeliveryInputSchema, body);
  milestone.deliveries.push({
    id: nextId("del"),
    links: input.links,
    note: input.note,
    submittedAt: nowIso(),
  });
  milestone.status = "SUBMITTED";
  activity(offer, "DELIVERY_SUBMITTED", `${user.name} submitted ${milestone.title}`, user, milestone.id);
  touch(offer);
  return toOffer(offer, user.id, getDb().users);
}

export function requestChanges(offerId: string, milestoneId: string, body: unknown) {
  const user = requireUser();
  const offer = requireOffer(offerId, user);
  const milestone = milestoneOr404(offer, milestoneId);
  assertMilestone(offer, milestone, user, "REQUEST_CHANGES");
  const input = parse(RequestChangesInputSchema, body);
  const delivery = milestone.deliveries.at(-1);
  if (delivery) delivery.review = { decision: "CHANGES_REQUESTED", comment: input.comment, reviewedAt: nowIso() };
  milestone.status = "CHANGES_REQUESTED";
  activity(offer, "CHANGES_REQUESTED", `${user.name} requested changes on ${milestone.title}`, user, milestone.id);
  touch(offer);
  return toOffer(offer, user.id, getDb().users);
}

export function approveMilestone(offerId: string, milestoneId: string) {
  const user = requireUser();
  const offer = requireOffer(offerId, user);
  const milestone = milestoneOr404(offer, milestoneId);
  assertMilestone(offer, milestone, user, "APPROVE");
  const delivery = milestone.deliveries.at(-1);
  if (delivery) delivery.review = { decision: "APPROVED", reviewedAt: nowIso() };
  milestone.approvedAt = nowIso();
  scheduleRelease(offer, milestone);
  activity(offer, "MILESTONE_APPROVED", `${user.name} approved ${milestone.title}`, user, milestone.id);
  touch(offer);
  return toOffer(offer, user.id, getDb().users);
}

export function cancelMilestone(offerId: string, milestoneId: string, body: unknown) {
  const user = requireUser();
  const offer = requireOffer(offerId, user);
  const milestone = milestoneOr404(offer, milestoneId);
  assertMilestone(offer, milestone, user, "CANCEL");
  parse(CancelReasonInputSchema, body ?? {});
  scheduleRefund(offer, milestone);
  touch(offer);
  return toOffer(offer, user.id, getDb().users);
}

export function retryMilestone(offerId: string, milestoneId: string) {
  const user = requireUser();
  const offer = requireOffer(offerId, user);
  const milestone = milestoneOr404(offer, milestoneId);
  assertMilestone(offer, milestone, user, "RETRY");
  if (milestone.status === "REFUND_FAILED" || milestone.status === "REFUNDING") scheduleRefund(offer, milestone);
  else scheduleRelease(offer, milestone);
  touch(offer);
  return toOffer(offer, user.id, getDb().users);
}

function milestoneOr404(offer: MockOffer, milestoneId: string) {
  const milestone = offer.milestones.find((item) => item.id === milestoneId);
  if (!milestone) fail(404, "NOT_FOUND", "Milestone not found.");
  return milestone;
}

export function startCard(offerId: string) {
  const user = requireUser();
  const offer = requireOffer(offerId, user);
  if (!offerActions(offer, viewerRole(offer, user)).some((action) => action === "ACCEPT_AND_PAY" || action === "CONTINUE_PAYMENT")) {
    fail(409, "INVALID_STATE", "That action isn't available.");
  }
  const attempt = (offer.payment?.attempt ?? 0) + (offer.payment?.status === "PENDING" ? 0 : 1);
  if (!offer.payment || offer.payment.status !== "PENDING") {
    offer.payment = {
      rail: "CARD",
      status: "PENDING",
      attempt: Math.max(attempt, 1),
      paymentIntentId: `int_mock_${offer.id}_${Math.max(attempt, 1)}`,
      clientSecret: `cs_mock_${offer.id}`,
    };
    eventApi(offer.id, "POST", "/api/v1/pa/payment_intents/create", { id: offer.payment.paymentIntentId, status: "REQUIRES_PAYMENT_METHOD" });
  }
  offer.status = "AWAITING_PAYMENT";
  offer.fundingRail = "CARD";
  touch(offer);
  return {
    offerId: offer.id,
    intentId: offer.payment.paymentIntentId!,
    clientSecret: offer.payment.clientSecret!,
    amount: money(totalMinor(offer)),
  };
}

export function submitMockCard(offerId: string, cardNumber: string) {
  const offer = getDb().offers.find((item) => item.id === offerId);
  if (!offer?.payment || offer.payment.rail !== "CARD") fail(409, "INVALID_STATE", "Start card payment first.");
  const digits = cardNumber.replace(/\D/g, "");
  if (digits === "4035501000000008") offer.payment.cardOutcome = "success";
  else if (digits === "4012000300001003") offer.payment.cardOutcome = "decline";
  else fail(422, "VALIDATION_FAILED", "Use a sandbox test card.", { card: ["Use a sandbox test card."] });
  commit();
  return offer.payment.cardOutcome;
}

export function reconcile(offerId: string) {
  const user = requireUser();
  const offer = requireOffer(offerId, user);
  if (offer.payment?.cardOutcome === "success" && offer.status === "AWAITING_PAYMENT") {
    eventHook(offer.id, "payment_intent.succeeded", offer.payment.paymentIntentId ?? offer.id);
    fundOffer(offer, "CARD");
  } else if (offer.payment?.cardOutcome === "decline" && offer.status === "AWAITING_PAYMENT") {
    offer.payment.status = "FAILED";
    offer.status = "SENT";
    offer.fundingRail = undefined;
    activity(offer, "PAYMENT_FAILED", "Card payment was declined");
    touch(offer);
  }
  return toOffer(offer, user.id, getDb().users);
}

export function cancelPayment(offerId: string) {
  const user = requireUser();
  const offer = requireOffer(offerId, user);
  assertOffer(offer, user, "CANCEL_PAYMENT");
  if (offer.payment) offer.payment.status = "CANCELLED";
  offer.status = "SENT";
  offer.fundingRail = undefined;
  touch(offer);
  return toOffer(offer, user.id, getDb().users);
}

export function payFromWallet(offerId: string) {
  const user = requireUser();
  const offer = requireOffer(offerId, user);
  if (!offerActions(offer, viewerRole(offer, user)).some((action) => action === "ACCEPT_AND_PAY" || action === "CONTINUE_PAYMENT")) {
    fail(409, "INVALID_STATE", "That action isn't available.");
  }
  const total = totalMinor(offer);
  if (user.availableMinor < total) fail(409, "INSUFFICIENT_BALANCE", "Wallet balance is too low.");
  user.availableMinor -= total;
  txn(user.id, "CHARGE", `Marketplace funding ${offer.shortRef}`, -total, offer.shortRef);
  offer.payment = { rail: "WALLET", status: "PENDING", attempt: 1, chargeId: `ch_mock_${offer.id}` };
  offer.status = "AWAITING_PAYMENT";
  offer.fundingRail = "WALLET";
  eventApi(offer.id, "POST", "/api/v1/charges/create", { id: offer.payment.chargeId, status: "PENDING" });
  scheduleMockJob(() => {
    eventHook(offer.id, "charge.settled", offer.payment?.chargeId ?? offer.id);
    fundOffer(offer, "WALLET");
  }, SETTLE_MS);
  touch(offer);
  return toOffer(offer, user.id, getDb().users);
}

export function wallet() {
  const user = requireUser();
  const held = (party: "buyer" | "seller") =>
    getDb()
      .offers.filter((offer) => (party === "buyer" ? offer.buyerId : offer.sellerId) === user.id)
      .flatMap((offer) => offer.milestones)
      .filter((milestone) => ["FUNDED", "SUBMITTED", "CHANGES_REQUESTED", "RELEASING", "RELEASE_FAILED"].includes(milestone.status))
      .reduce((sum, milestone) => sum + milestone.amountMinor, 0);
  return {
    account: {
      accountId: user.airwallex.accountId ?? "acct_mock_pending",
      status: user.airwallex.accountStatus ?? "CREATED",
      label: "Airwallex connected account (sandbox)",
    },
    balances: [
      {
        currency: "USD",
        available: money(user.availableMinor),
        pending: money(user.pendingMinor),
        reserved: money(user.reservedMinor),
        total: money(user.availableMinor + user.pendingMinor + user.reservedMinor),
      },
    ],
    unreleased: { heldAsBuyer: money(held("buyer")), incomingAsSeller: money(held("seller")) },
  };
}

export function transactions(cursor: string | undefined) {
  const user = requireUser();
  const pageSize = 10;
  const start = cursor ? Number(cursor) : 0;
  const rows = getDb()
    .transactions.filter((item) => item.userId === user.id)
    .sort((a, b) => b.at.localeCompare(a.at));
  const items = rows.slice(start, start + pageSize).map((item) => without(item, "userId"));
  const next = start + pageSize < rows.length ? String(start + pageSize) : undefined;
  return { items, nextCursor: next };
}

export function withdraw(body: unknown) {
  const user = requireUser();
  const input = parse(WithdrawalInputSchema, body);
  const amount = fromAwxAmount(input.amount, "USD");
  if (amount <= 0 || amount > user.availableMinor) fail(409, "INSUFFICIENT_BALANCE", "Wallet balance is too low.");
  user.availableMinor -= amount;
  const transferId = nextId("tr");
  txn(user.id, "PAYOUT", "Withdrawal", -amount, transferId);
  commit();
  return { ok: true as const, transferId };
}

export function sendFunds(body: unknown) {
  const user = requireUser();
  const input = parse(SendFundsInputSchema, body);
  const recipient = getDb().users.find((item) => item.id === input.recipientId && item.provisioning.step === "READY");
  if (!recipient || recipient.kind === "REVENUE") fail(404, "NOT_FOUND", "Recipient not found.");
  const amount = fromAwxAmount(input.amount, "USD");
  if (amount <= 0 || amount > user.availableMinor) fail(409, "INSUFFICIENT_BALANCE", "Wallet balance is too low.");
  user.availableMinor -= amount;
  recipient.availableMinor += amount;
  txn(user.id, "TRANSFER_OUT", `Sent to ${recipient.name}`, -amount);
  txn(recipient.id, "TRANSFER_IN", `Received from ${user.name}`, amount);
  commit();
  return { ok: true as const };
}

export function platformOverview() {
  requireUser();
  const db = getDb();
  const revenue = db.users.find((user) => user.kind === "REVENUE");
  const offers: Record<string, number> = {};
  const milestones: Record<string, number> = {};
  let fees = 0;
  const stuck: Array<{
    offerId: string;
    offerTitle: string;
    milestoneId: string;
    milestoneTitle: string;
    status: MockMilestone["status"];
    since: string;
  }> = [];
  const cutoff = Date.now() - 2 * 60 * 1000;
  for (const offer of db.offers) {
    offers[offer.status] = (offers[offer.status] ?? 0) + 1;
    for (const milestone of offer.milestones) {
      milestones[milestone.status] = (milestones[milestone.status] ?? 0) + 1;
      if (milestone.status === "PAID") fees += milestone.breakdown.revenueMinor;
      if (
        (milestone.status === "RELEASING" || milestone.status === "REFUNDING") &&
        milestone.pendingSince &&
        Date.parse(milestone.pendingSince) <= cutoff
      ) {
        stuck.push({
          offerId: offer.id,
          offerTitle: offer.title,
          milestoneId: milestone.id,
          milestoneTitle: milestone.title,
          status: milestone.status,
          since: milestone.pendingSince,
        });
      }
    }
  }
  const balance = (availableMinor: number) => ({
    currency: "USD",
    available: money(availableMinor),
    pending: money(0),
    reserved: money(0),
    total: money(availableMinor),
  });
  return {
    platformBalances: [balance(db.platformAvailableMinor)],
    revenueAccount: { accountId: revenue?.airwallex.accountId ?? "acct_mock_revenue", balances: [balance(revenue?.availableMinor ?? 0)] },
    feesCollected: money(fees),
    counts: { offers, milestones },
    stuck,
  };
}

export function platformWebhooks() {
  requireUser();
  return getDb()
    .events.filter((event) => event.source === "WEBHOOK")
    .slice(-50)
    .reverse()
    .map((event) => ({
      id: event.id,
      name: event.source === "WEBHOOK" ? event.name : "",
      objectId: event.source === "WEBHOOK" ? event.objectId : undefined,
      receivedAt: event.at,
      processed: event.source === "WEBHOOK" ? event.processed : false,
      processingError: event.source === "WEBHOOK" ? event.processingError : undefined,
    }));
}

export function setMockUser(userId: string) {
  if (!getDb().users.some((user) => user.id === userId && user.kind !== "REVENUE")) {
    fail(404, "NOT_FOUND", "User not found.");
  }
  getDb().sessionUserId = userId;
  commit();
}

