/**
 * @vitest-environment node
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import type { JsonObject } from "@/lib/airwallex/json";
import type { CreateRefundInput } from "@/lib/airwallex/refunds";
import { resetServerConfigCache } from "@/lib/config";
import { connectDb, disconnectDb } from "@/lib/db";
import { Activity } from "@/models/activity";
import { Offer } from "@/models/offer";
import { Payment } from "@/models/payment";
import { PlatformSettings } from "@/models/platformSettings";
import { User, type UserDocument } from "@/models/user";
import { InvalidState } from "@/server/errors";
import { approveMilestone, cancelRemaining, refundMilestone, retryMilestone, type RefundGateway, type ReleaseGateway, type SplitGateway } from "@/services/escrow";
import { startCardPayment, reconcileCardPayment, type CardGateway } from "@/services/funding";
import { createAndSend, submitDelivery } from "@/services/offers";
import { dispatchWebhook } from "@/services/webhookHandlers";

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri();
  process.env.SESSION_SECRET = "s".repeat(40);
  resetServerConfigCache();
  await connectDb();
}, 120_000);

afterAll(async () => {
  await disconnectDb();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Offer.deleteMany({}),
    Payment.deleteMany({}),
    Activity.deleteMany({}),
    PlatformSettings.deleteMany({}),
  ]);
});

async function readyUser(email: string, name: string, accountId: string): Promise<UserDocument> {
  return User.create({
    email,
    name,
    passwordHash: "unused",
    avatarColor: "#57534E",
    kind: "REGULAR",
    isGuestPool: false,
    airwallex: { accountId, accountStatus: "ACTIVE", provisioning: { step: "READY", updatedAt: new Date() } },
  });
}

function cards(status = "SUCCEEDED"): CardGateway {
  return {
    async createPaymentIntent() {
      return { id: "int_1", client_secret: "cs_1", status: "REQUIRES_PAYMENT_METHOD" };
    },
    async retrievePaymentIntent(id: string) {
      return { id, status } satisfies JsonObject;
    },
    async cancelPaymentIntent(id: string) {
      return { id, status: "CANCELLED" } satisfies JsonObject;
    },
  };
}

function rails(options?: { failRelease?: boolean }): SplitGateway & ReleaseGateway & { releases: string[] } {
  let n = 0;
  const releases: string[] = [];
  return {
    releases,
    async createFundsSplit() {
      n += 1;
      return { id: `spt_${n}`, status: "CREATED" };
    },
    async retrieveFundsSplit(splitId: string) {
      return { id: splitId, status: releases.includes(splitId) ? "SETTLED" : "CREATED" };
    },
    async releaseFundsSplit(splitId: string) {
      if (options?.failRelease) throw new Error("Airwallex timed out");
      releases.push(splitId);
      return { id: splitId, status: "RELEASED" };
    },
  };
}

async function fundedOffer() {
  const seller = await readyUser("maya@example.com", "Maya Chen", "acct_seller");
  const buyer = await readyUser("sam@example.com", "Sam Rivera", "acct_buyer");
  await PlatformSettings.create({
    _id: "default",
    revenueUserId: seller._id,
    revenueAccountId: "acct_revenue",
    seedVersion: 1,
    lastSeededAt: new Date(),
  });
  const sent = await createAndSend(seller, {
    buyerId: buyer._id.toString(),
    title: "Landing page",
    description: "A small site.",
    milestones: [
      { title: "Design", amount: "100.00" },
      { title: "Build", amount: "50.00" },
    ],
  });
  const gateway = rails();
  await startCardPayment(buyer, sent.id, cards("REQUIRES_PAYMENT_METHOD"));
  await reconcileCardPayment(buyer, sent.id, cards("SUCCEEDED"), gateway);
  return { seller, buyer, offerId: sent.id, gateway };
}

async function deliver(seller: UserDocument, offerId: string, milestoneId: string) {
  return submitDelivery(seller, offerId, milestoneId, { links: ["https://example.com/design"] });
}

describe("approval and release", () => {
  it("releases a delivered milestone and pays it when both splits settle", async () => {
    const { seller, buyer, offerId, gateway } = await fundedOffer();
    const funded = await Offer.findById(offerId);
    const first = funded?.milestones[0];
    const second = funded?.milestones[1];
    if (!first || !second) throw new Error("missing milestones");

    const submitted = await deliver(seller, offerId, first._id.toString());
    expect(submitted.milestones[0]?.status).toBe("SUBMITTED");
    await expect(approveMilestone(seller, offerId, first._id.toString(), gateway)).rejects.toBeInstanceOf(InvalidState);

    const releasing = await approveMilestone(buyer, offerId, first._id.toString(), gateway);
    expect(releasing.milestones[0]?.status).toBe("RELEASING");
    expect(releasing.milestones[0]?.escrowLegs.map((leg) => leg.status)).toEqual(["RELEASED", "RELEASED"]);
    expect(gateway.releases).toEqual([first.escrow?.sellerSplit?.splitId, first.escrow?.revenueSplit?.splitId]);
    expect(releasing.status).toBe("ACTIVE");

    const sellerSplit = first.escrow?.sellerSplit?.splitId ?? "";
    const revenueSplit = first.escrow?.revenueSplit?.splitId ?? "";
    await dispatchWebhook({
      id: "evt_seller",
      name: "funds_split.settled",
      data: { object: { id: sellerSplit, status: "SETTLED" } },
    });
    const halfway = await Offer.findById(offerId);
    expect(halfway?.milestones[0]?.status).toBe("RELEASING");

    await dispatchWebhook({
      id: "evt_revenue",
      name: "funds_split.settled",
      data: { object: { id: revenueSplit, status: "SETTLED" } },
    });
    const paid = await Offer.findById(offerId);
    expect(paid?.milestones[0]?.status).toBe("PAID");
    expect(paid?.milestones[1]?.status).toBe("FUNDED");
    expect(paid?.status).toBe("ACTIVE");

    await deliver(seller, offerId, second._id.toString());
    await approveMilestone(buyer, offerId, second._id.toString(), gateway);
    await dispatchWebhook({
      id: "evt_seller_2",
      name: "funds_split.settled",
      data: { object: { id: second.escrow?.sellerSplit?.splitId, status: "SETTLED" } },
    });
    const completed = await dispatchWebhook({
      id: "evt_revenue_2",
      name: "funds_split.settled",
      data: { object: { id: second.escrow?.revenueSplit?.splitId, status: "SETTLED" } },
    });
    expect(completed).toBe(offerId);
    const done = await Offer.findById(offerId);
    expect(done?.status).toBe("COMPLETED");
    expect(done?.milestones.map((milestone) => milestone.status)).toEqual(["PAID", "PAID"]);
  });

  it("keeps a timed-out release retryable, and marks a failed split", async () => {
    const { seller, buyer, offerId } = await fundedOffer();
    const funded = await Offer.findById(offerId);
    const first = funded?.milestones[0];
    if (!first?.escrow?.sellerSplit) throw new Error("missing split");
    await deliver(seller, offerId, first._id.toString());

    const failing = rails({ failRelease: true });
    const stuck = await approveMilestone(buyer, offerId, first._id.toString(), failing);
    expect(stuck.milestones[0]?.status).toBe("RELEASING");
    expect(stuck.milestones[0]?.lastError).toBe("Airwallex timed out");
    expect(stuck.milestones[0]?.allowedActions).toContain("RETRY");

    const recovered = await retryMilestone(buyer, offerId, first._id.toString(), rails());
    expect(recovered.milestones[0]?.status).toBe("RELEASING");
    expect(recovered.milestones[0]?.lastError).toBeUndefined();
    expect(recovered.milestones[0]?.escrowLegs.map((leg) => leg.status)).toEqual(["RELEASED", "RELEASED"]);

    await dispatchWebhook({
      id: "evt_failed",
      name: "funds_split.failed",
      data: { object: { id: first.escrow.sellerSplit.splitId, status: "FAILED" } },
    });
    const failed = await Offer.findById(offerId);
    expect(failed?.milestones[0]?.status).toBe("RELEASE_FAILED");
    expect(failed?.milestones[0]?.lastError).toMatch(/could not release/);
  });
});

function cardRefunds(failCreate = false): RefundGateway & { reversals: number } {
  const gateway = {
    reversals: 0,
    async createRefund(input: CreateRefundInput) {
      if (failCreate) throw new Error("Airwallex timed out");
      return { id: `rfd_${input.metadata?.milestoneId ?? "x"}`, status: "RECEIVED" } satisfies JsonObject;
    },
    async createFundsSplitReversal() {
      gateway.reversals += 1;
      throw new Error("Insufficient funds in USD currency.");
    },
    async retrieveRefund(refundId: string) {
      return { id: refundId, status: "ACCEPTED" } satisfies JsonObject;
    },
  };
  return gateway;
}

describe("cancellation and refunds", () => {
  it("refunds an unreleased milestone even when the split reversal has no funds", async () => {
    const { seller, buyer, offerId } = await fundedOffer();
    const funded = await Offer.findById(offerId);
    const first = funded?.milestones[0];
    const second = funded?.milestones[1];
    if (!first || !second) throw new Error("missing milestones");
    const gateway = cardRefunds();

    const refunding = await refundMilestone(seller, offerId, first._id.toString(), { reason: "Scope changed" }, gateway);
    expect(refunding.milestones[0]?.status).toBe("REFUNDING");
    expect(refunding.milestones[0]?.escrowLegs.some((leg) => leg.kind === "REFUND" && leg.airwallexId === `rfd_${first._id.toString()}`)).toBe(true);
    expect(gateway.reversals).toBe(2);
    expect(refunding.status).toBe("ACTIVE");
    const payment = await Payment.findOne({ offerId });
    expect(payment?.refundedMinor).toBe(10_000);

    await dispatchWebhook({
      id: "evt_refund_1",
      name: "refund.accepted",
      data: { object: { id: `rfd_${first._id.toString()}`, status: "ACCEPTED", metadata: { milestoneId: first._id.toString() } } },
    });
    const halfway = await Offer.findById(offerId);
    expect(halfway?.milestones[0]?.status).toBe("REFUNDED");
    expect(halfway?.status).toBe("ACTIVE");

    const remaining = await cancelRemaining(buyer, offerId, {}, gateway);
    expect(remaining.milestones[1]?.status).toBe("REFUNDING");
    await dispatchWebhook({
      id: "evt_refund_2",
      name: "refund.settled",
      data: { object: { id: `rfd_${second._id.toString()}`, status: "SETTLED" } },
    });
    const cancelled = await Offer.findById(offerId);
    expect(cancelled?.milestones.map((milestone) => milestone.status)).toEqual(["REFUNDED", "REFUNDED"]);
    expect(cancelled?.status).toBe("CANCELLED");
    await expect(refundMilestone(buyer, offerId, second._id.toString(), {}, gateway)).rejects.toBeInstanceOf(InvalidState);
  });

  it("keeps a failed refund retryable", async () => {
    const { buyer, offerId } = await fundedOffer();
    const funded = await Offer.findById(offerId);
    const first = funded?.milestones[0];
    if (!first) throw new Error("missing milestone");
    const stuck = await refundMilestone(buyer, offerId, first._id.toString(), {}, cardRefunds(true));
    expect(stuck.milestones[0]?.status).toBe("REFUNDING");
    expect(stuck.milestones[0]?.lastError).toBe("Airwallex timed out");
    expect(stuck.milestones[0]?.allowedActions).toContain("RETRY");

    const recovered = await retryMilestone(buyer, offerId, first._id.toString(), undefined, cardRefunds());
    expect(recovered.milestones[0]?.status).toBe("REFUNDING");
    expect(recovered.milestones[0]?.lastError).toBeUndefined();
    expect(recovered.milestones[0]?.escrowLegs.some((leg) => leg.kind === "REFUND")).toBe(true);
  });
});
