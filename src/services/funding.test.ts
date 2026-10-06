/**
 * @vitest-environment node
 */
import { createHmac } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import type { JsonObject } from "@/lib/airwallex/json";
import { resetServerConfigCache } from "@/lib/config";
import { connectDb, disconnectDb } from "@/lib/db";
import { Activity } from "@/models/activity";
import { Offer } from "@/models/offer";
import { Payment } from "@/models/payment";
import { PlatformSettings } from "@/models/platformSettings";
import { User, type UserDocument } from "@/models/user";
import { WebhookEvent } from "@/models/webhookEvent";
import { InvalidState } from "@/server/errors";
import type { SplitGateway } from "@/services/release";
import { cancelCardPayment, reconcileCardPayment, startCardPayment, type CardGateway, type CardRefundGateway } from "@/services/funding";
import { createAndSend, getOffer } from "@/services/offers";
import { dispatchWebhook, type WebhookLookup } from "@/services/webhookHandlers";
import { POST as webhook } from "@/app/api/webhooks/airwallex/route";

let mongo: MongoMemoryServer;
const secret = "whsec_test";

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri();
  process.env.SESSION_SECRET = "s".repeat(40);
  process.env.AIRWALLEX_WEBHOOK_SECRET = secret;
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

function cards(status = "REQUIRES_PAYMENT_METHOD"): CardGateway & { created: number; cancelled: string[] } {
  const gateway = {
    created: 0,
    cancelled: [] as string[],
    async createPaymentIntent() {
      gateway.created += 1;
      return {
        id: `int_${gateway.created}`,
        client_secret: `cs_${gateway.created}`,
        status: "REQUIRES_PAYMENT_METHOD",
      } satisfies JsonObject;
    },
    async retrievePaymentIntent(id: string) {
      return { id, status } satisfies JsonObject;
    },
    async cancelPaymentIntent(id: string) {
      gateway.cancelled.push(id);
      return { id, status: "CANCELLED" } satisfies JsonObject;
    },
  };
  return gateway;
}

function confirmedLookup(status = "SUCCEEDED"): WebhookLookup {
  return {
    async retrievePaymentIntent(id: string) {
      return { id, status };
    },
    async retrieveCharge(id: string) {
      return { id, status: "SETTLED" };
    },
  };
}

function refunds(): CardRefundGateway & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async createRefund(input) {
      calls.push(input.requestId);
      return { id: `rfd_${input.requestId}`, status: "RECEIVED" };
    },
  };
}

function splits(): SplitGateway & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async createFundsSplit(input) {
      calls.push(`${input.metadata?.share}:${input.amountMinor}:${input.autoRelease}`);
      return { id: `spt_${input.metadata?.share}`, status: "CREATED" } satisfies JsonObject;
    },
    async retrieveFundsSplit(splitId) {
      return { id: splitId, status: "CREATED" };
    },
  };
}

async function sentOffer() {
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
    milestones: [
      { title: "Design", amount: "100.00" },
      { title: "Build", amount: "50.00" },
    ],
  });
  return { seller, buyer, offer };
}

describe("card funding", () => {
  it("creates one PaymentIntent and reuses it", async () => {
    const { buyer, offer } = await sentOffer();
    const gateway = cards();
    const first = await startCardPayment(buyer, offer.id, gateway);
    const second = await startCardPayment(buyer, offer.id, gateway);
    expect(first).toMatchObject({ intentId: "int_1", clientSecret: "cs_1", amount: { amountMinor: 15_000, currency: "USD" } });
    expect(second.intentId).toBe(first.intentId);
    expect(gateway.created).toBe(1);
    const stored = await Offer.findById(offer.id);
    expect(stored?.status).toBe("AWAITING_PAYMENT");
    expect(stored?.fundingRail).toBe("CARD");
  });

  it("holds a succeeded payment in two splits per milestone", async () => {
    const { seller, buyer, offer } = await sentOffer();
    const gateway = cards("SUCCEEDED");
    const held = splits();
    await startCardPayment(buyer, offer.id, cards());
    const funded = await reconcileCardPayment(buyer, offer.id, gateway, held);
    expect(funded.status).toBe("ACTIVE");
    expect(funded.payment?.status).toBe("SUCCEEDED");
    expect(funded.milestones.map((milestone) => milestone.status)).toEqual(["FUNDED", "FUNDED"]);
    expect(funded.milestones[0]?.releaseLegs.map((leg) => leg.airwallexId)).toEqual(["spt_SELLER", "spt_REVENUE"]);
    expect(held.calls).toEqual(["SELLER:9000:false", "REVENUE:800:false", "SELLER:4500:false", "REVENUE:400:false"]);
    const asSeller = await getOffer(seller, offer.id);
    expect(asSeller.milestones[0]?.allowedActions).toContain("SUBMIT_DELIVERY");
  });

  it("sends the offer back when the card is declined, and lets the buyer cancel", async () => {
    const { buyer, offer } = await sentOffer();
    const gateway = cards();
    await startCardPayment(buyer, offer.id, gateway);
    const declined = await reconcileCardPayment(buyer, offer.id, cards("FAILED"));
    expect(declined.status).toBe("SENT");
    expect(declined.payment?.status).toBe("FAILED");
    expect(declined.fundingRail).toBeUndefined();

    await startCardPayment(buyer, offer.id, gateway);
    const cancelled = await cancelCardPayment(buyer, offer.id, gateway);
    expect(cancelled.status).toBe("SENT");
    expect(gateway.cancelled).toEqual(["int_2"]);
    await expect(cancelCardPayment(buyer, offer.id, gateway)).rejects.toBeInstanceOf(InvalidState);
  });

  it("funds the offer when cancel finds the PaymentIntent already succeeded", async () => {
    const { buyer, offer } = await sentOffer();
    const held = splits();
    await startCardPayment(buyer, offer.id, cards());
    const paid = cards("SUCCEEDED");
    const funded = await cancelCardPayment(buyer, offer.id, paid, held);
    expect(funded.status).toBe("ACTIVE");
    expect(paid.cancelled).toEqual([]);
    expect(held.calls).toHaveLength(4);
  });

  it("refunds a capture that lands after checkout was cancelled", async () => {
    const { buyer, offer } = await sentOffer();
    const gateway = cards();
    const held = splits();
    const returning = refunds();
    const session = await startCardPayment(buyer, offer.id, gateway);
    const cancelled = await cancelCardPayment(buyer, offer.id, gateway);
    expect(cancelled.status).toBe("SENT");

    await dispatchWebhook(
      {
        id: "evt_late",
        name: "payment_intent.succeeded",
        data: { object: { id: session.intentId, status: "SUCCEEDED", metadata: { offerId: offer.id } } },
      },
      held,
      confirmedLookup(),
      returning,
    );
    const synced = await reconcileCardPayment(buyer, offer.id, cards("SUCCEEDED"), held, returning);
    expect(synced.status).toBe("SENT");
    expect(held.calls).toEqual([]);
    expect(returning.calls).toEqual([expect.stringMatching(/^rf:cancel:/)]);
    const payment = await Payment.findOne({ offerId: offer.id });
    expect(payment?.status).toBe("CANCELLED");
    expect(payment?.refundedMinor).toBe(15_000);
  });

  it("funds from the payment webhook once and rejects a bad signature", async () => {
    const { buyer, offer } = await sentOffer();
    const held = splits();
    const session = await startCardPayment(buyer, offer.id, cards());
    const event = {
      id: "evt_paid",
      name: "payment_intent.succeeded",
      data: { object: { id: session.intentId, status: "SUCCEEDED", metadata: { offerId: offer.id } } },
    };
    const lookup = confirmedLookup();
    await dispatchWebhook(event, held, lookup);
    await dispatchWebhook(event, held, lookup);
    const funded = await getOffer(buyer, offer.id);
    expect(funded.status).toBe("ACTIVE");
    expect(held.calls).toHaveLength(4);

    await dispatchWebhook(event, held, confirmedLookup("REQUIRES_PAYMENT_METHOD"));
    expect(held.calls).toHaveLength(4);

    const raw = JSON.stringify({ id: "evt_ping", name: "ping" });
    const timestamp = String(Date.now());
    const signature = createHmac("sha256", secret).update(timestamp + raw).digest("hex");
    const ok = await webhook(
      new Request("http://localhost/api/webhooks/airwallex", {
        method: "POST",
        headers: { "x-timestamp": timestamp, "x-signature": signature },
        body: raw,
      }),
    );
    const again = await webhook(
      new Request("http://localhost/api/webhooks/airwallex", {
        method: "POST",
        headers: { "x-timestamp": timestamp, "x-signature": signature },
        body: raw,
      }),
    );
    expect(ok.status).toBe(200);
    expect(await again.json()).toMatchObject({ duplicate: true });

    const bad = await webhook(
      new Request("http://localhost/api/webhooks/airwallex", {
        method: "POST",
        headers: { "x-timestamp": timestamp, "x-signature": "nope" },
        body: raw,
      }),
    );
    expect(bad.status).toBe(400);
  });

  it("rejects a webhook signed only with client-secret-key unless the test flag is on", async () => {
    const raw = JSON.stringify({ id: "evt_test_sig", name: "ping" });
    const timestamp = String(Date.now());
    const testSecret = "attacker-secret";
    const signature = createHmac("sha256", testSecret).update(timestamp + raw).digest("hex");
    const headers = { "x-timestamp": timestamp, "x-signature": signature, "client-secret-key": testSecret };
    const forged = await webhook(new Request("http://localhost/api/webhooks/airwallex", { method: "POST", headers, body: raw }));
    expect(forged.status).toBe(400);

    const env = process.env as Record<string, string | undefined>;
    env.AIRWALLEX_ALLOW_WEBHOOK_TEST_SIGNATURES = "true";
    const previousEnv = env.NODE_ENV;
    try {
      const allowed = await webhook(new Request("http://localhost/api/webhooks/airwallex", { method: "POST", headers, body: raw }));
      expect(allowed.status).toBe(200);

      env.NODE_ENV = "production";
      const production = await webhook(new Request("http://localhost/api/webhooks/airwallex", { method: "POST", headers, body: raw }));
      expect(production.status).toBe(400);
    } finally {
      env.NODE_ENV = previousEnv;
      delete env.AIRWALLEX_ALLOW_WEBHOOK_TEST_SIGNATURES;
    }
  });

  it("does not fund an offer when the retrieved PaymentIntent is not succeeded", async () => {
    const { buyer, offer } = await sentOffer();
    const held = splits();
    const session = await startCardPayment(buyer, offer.id, cards());
    await dispatchWebhook(
      {
        id: "evt_unpaid",
        name: "payment_intent.succeeded",
        data: { object: { id: session.intentId, status: "SUCCEEDED", metadata: { offerId: offer.id } } },
      },
      held,
      confirmedLookup("REQUIRES_PAYMENT_METHOD"),
    );
    const waiting = await getOffer(buyer, offer.id);
    expect(waiting.status).toBe("AWAITING_PAYMENT");
    expect(held.calls).toEqual([]);
  });
});
