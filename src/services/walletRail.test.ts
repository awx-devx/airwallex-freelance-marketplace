/**
 * @vitest-environment node
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { resetServerConfigCache } from "@/lib/config";
import { connectDb, disconnectDb } from "@/lib/db";
import { Activity } from "@/models/activity";
import { Offer } from "@/models/offer";
import { Payment } from "@/models/payment";
import { PlatformSettings } from "@/models/platformSettings";
import { User, type UserDocument } from "@/models/user";
import { WebhookEvent } from "@/models/webhookEvent";
import { InsufficientBalance, InvalidState } from "@/server/errors";
import { approveMilestone, refundMilestone, type TransferGateway } from "@/services/escrow";
import { payFromWallet, type WalletGateway } from "@/services/funding";
import { createAndSend, submitDelivery } from "@/services/offers";
import { platformOverview } from "@/services/platform";
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
    WebhookEvent.deleteMany({}),
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

async function sentOffer(amounts = ["100.00", "50.00"]) {
  const seller = await readyUser("maya@example.com", "Maya Chen", "acct_seller");
  const buyer = await readyUser("sam@example.com", "Sam Rivera", "acct_buyer");
  await PlatformSettings.create({
    _id: "default",
    revenueUserId: seller._id,
    revenueAccountId: "acct_revenue",
    seedVersion: 1,
    lastSeededAt: new Date(),
  });
  const offer = await createAndSend(seller, {
    buyerId: buyer._id.toString(),
    title: "Landing page",
    description: "A small site.",
    milestones: amounts.map((amount, index) => ({ title: index === 0 ? "Design" : "Build", amount })),
  });
  return { seller, buyer, offer };
}

function wallet(availableMajor: number, chargeStatus = "PENDING"): WalletGateway & { created: number } {
  const gateway = {
    created: 0,
    async currentBalances() {
      return [{ currency: "USD", account_type: "cash", available_amount: availableMajor, pending_amount: 0, reserved_amount: 0 }];
    },
    async createCharge() {
      gateway.created += 1;
      return { id: `ch_${gateway.created}`, status: chargeStatus };
    },
    async retrieveCharge(id: string) {
      return { id, status: chargeStatus };
    },
  };
  return gateway;
}

function transfers(status = "PENDING"): TransferGateway & { calls: Array<{ amountMinor: number; destination: string; requestId: string }> } {
  const calls: Array<{ amountMinor: number; destination: string; requestId: string }> = [];
  let next = 0;
  return {
    calls,
    async createConnectedAccountTransfer(input) {
      next += 1;
      calls.push({ amountMinor: input.amountMinor, destination: input.destination, requestId: input.requestId });
      return { id: `tr_${next}`, status, request_id: input.requestId };
    },
    async retrieveConnectedAccountTransfer(id: string) {
      return { id, status };
    },
  };
}

describe("wallet funding", () => {
  it("refuses a wallet payment when the balance is too low", async () => {
    const { buyer, offer } = await sentOffer();
    const gateway = wallet(1);
    await expect(payFromWallet(buyer, offer.id, gateway)).rejects.toBeInstanceOf(InsufficientBalance);
    expect(gateway.created).toBe(0);
    expect(await Payment.countDocuments()).toBe(0);
  });

  it("creates one charge and reuses it until the charge settles", async () => {
    const { buyer, offer } = await sentOffer();
    const gateway = wallet(500, "PENDING");
    const waiting = await payFromWallet(buyer, offer.id, gateway);
    expect(waiting.status).toBe("AWAITING_PAYMENT");
    expect(waiting.fundingRail).toBe("WALLET");
    expect(gateway.created).toBe(1);

    const again = await payFromWallet(buyer, offer.id, gateway);
    expect(again.status).toBe("AWAITING_PAYMENT");
    expect(gateway.created).toBe(1);

    const payment = await Payment.findOne({ offerId: offer.id });
    await dispatchWebhook({ name: "charge.settled", data: { object: { id: payment?.chargeId } } });
    const funded = await Offer.findById(offer.id);
    expect(funded?.status).toBe("ACTIVE");
    expect(funded?.fundingRail).toBe("WALLET");
    expect(funded?.milestones.map((milestone) => milestone.status)).toEqual(["FUNDED", "FUNDED"]);
    expect(funded?.milestones.every((milestone) => !milestone.escrow?.sellerSplit && !milestone.escrow?.revenueSplit)).toBe(true);
    const notes = await Activity.find({ offerId: offer.id, type: "PAYMENT_SUCCEEDED" });
    expect(notes.map((note) => note.message)).toContain("Payment received from wallet");
  });

  it("leaves the offer sent when the charge fails", async () => {
    const { buyer, offer } = await sentOffer();
    const gateway = wallet(500, "FAILED");
    await expect(payFromWallet(buyer, offer.id, gateway)).rejects.toBeInstanceOf(InvalidState);
    const stored = await Offer.findById(offer.id);
    expect(stored?.status).toBe("SENT");
    expect(stored?.fundingRail).toBeUndefined();
    expect(stored?.milestones.every((milestone) => milestone.status === "PENDING_FUNDING")).toBe(true);
  });
});

describe("wallet release and refund", () => {
  it("pays a milestone when both transfers settle, then completes the offer", async () => {
    const { seller, buyer, offer } = await sentOffer();
    await payFromWallet(buyer, offer.id, wallet(500, "SETTLED"));
    const funded = await Offer.findById(offer.id);
    const first = funded?.milestones[0];
    const second = funded?.milestones[1];
    if (!first || !second) throw new Error("missing milestones");

    await submitDelivery(seller, offer.id, first._id.toString(), { links: ["https://example.com/design"] });
    const gateway = transfers("PENDING");
    const releasing = await approveMilestone(buyer, offer.id, first._id.toString(), undefined, gateway);
    expect(releasing.milestones[0]?.status).toBe("RELEASING");
    expect(gateway.calls.map((call) => [call.amountMinor, call.destination])).toEqual([
      [9000, "acct_seller"],
      [800, "acct_revenue"],
    ]);

    await dispatchWebhook({
      name: "connected_account_transfer.settled",
      data: { object: { id: "tr_1", status: "SETTLED", request_id: gateway.calls[0]?.requestId } },
    });
    expect((await Offer.findById(offer.id))?.milestones[0]?.status).toBe("RELEASING");
    await dispatchWebhook({
      name: "connected_account_transfer.settled",
      data: { object: { id: "tr_2", status: "SETTLED", request_id: gateway.calls[1]?.requestId } },
    });
    const paid = await Offer.findById(offer.id);
    expect(paid?.milestones[0]?.status).toBe("PAID");
    expect(paid?.milestones[1]?.status).toBe("FUNDED");
    expect(paid?.status).toBe("ACTIVE");

    await submitDelivery(seller, offer.id, second._id.toString(), { links: ["https://example.com/build"] });
    const rest = transfers("SETTLED");
    await approveMilestone(buyer, offer.id, second._id.toString(), undefined, rest);
    expect(rest.calls.map((call) => call.amountMinor)).toEqual([4500, 400]);
    const done = await Offer.findById(offer.id);
    expect(done?.status).toBe("COMPLETED");
    expect(done?.milestones.map((milestone) => milestone.status)).toEqual(["PAID", "PAID"]);
  });

  it("refunds the buyer by transfer and cancels a fully refunded offer", async () => {
    const { buyer, offer } = await sentOffer(["100.00"]);
    await payFromWallet(buyer, offer.id, wallet(500, "SETTLED"));
    const funded = await Offer.findById(offer.id);
    const milestone = funded?.milestones[0];
    if (!milestone) throw new Error("missing milestone");
    const gateway = transfers("SETTLED");
    const cancelled = await refundMilestone(buyer, offer.id, milestone._id.toString(), {}, undefined, gateway);
    expect(gateway.calls).toEqual([{ amountMinor: 10000, destination: "acct_buyer", requestId: gateway.calls[0]?.requestId }]);
    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.milestones[0]?.status).toBe("REFUNDED");
    expect(cancelled.milestones[0]?.escrowLegs).toEqual([
      expect.objectContaining({ kind: "CA_TRANSFER", share: "BUYER_REFUND", status: "SETTLED" }),
    ]);
  });

  it("ignores welcome and seed top-up transfers", async () => {
    const related = await dispatchWebhook({
      name: "connected_account_transfer.settled",
      data: { object: { id: "tr_welcome", status: "SETTLED", request_id: "welcome:user" } },
    });
    expect(related).toBeUndefined();
  });
});

describe("platform overview", () => {
  it("sums paid revenue and reads injected balances", async () => {
    const { seller, buyer, offer } = await sentOffer(["100.00"]);
    await payFromWallet(buyer, offer.id, wallet(500, "SETTLED"));
    const funded = await Offer.findById(offer.id);
    const milestone = funded?.milestones[0];
    if (!milestone) throw new Error("missing milestone");
    await submitDelivery(seller, offer.id, milestone._id.toString(), { links: ["https://example.com/design"] });
    await approveMilestone(buyer, offer.id, milestone._id.toString(), undefined, transfers("SETTLED"));

    let calls = 0;
    const overview = await platformOverview(async (onBehalfOf) => {
      calls += 1;
      const available = onBehalfOf ? 8 : 2;
      return [{ currency: "USD", account_type: "cash", available_amount: available, pending_amount: 0, reserved_amount: 0 }];
    });
    expect(calls).toBe(2);
    expect(overview.feesCollected).toEqual({ amountMinor: 800, currency: "USD" });
    expect(overview.revenueAccount.accountId).toBe("acct_revenue");
    expect(overview.platformBalances[0]?.available.amountMinor).toBe(200);
    expect(overview.counts.offers.COMPLETED).toBe(1);
    expect(overview.counts.milestones.PAID).toBe(1);
  });
});
