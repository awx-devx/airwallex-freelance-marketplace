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
import type { SplitGateway } from "@/services/escrow";
import { cancelCardPayment, reconcileCardPayment, startCardPayment, type CardGateway } from "@/services/funding";
import { createAndSend, getOffer } from "@/services/offers";
import { dispatchWebhook } from "@/services/webhookHandlers";
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

function cards(status = "REQUIRES_PAYMENT_METHOD"): CardGateway & { created: number } {
  const gateway = {
    created: 0,
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
  };
  return gateway;
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
    expect(funded.milestones[0]?.escrowLegs.map((leg) => leg.airwallexId)).toEqual(["spt_SELLER", "spt_REVENUE"]);
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
    const cancelled = await cancelCardPayment(buyer, offer.id);
    expect(cancelled.status).toBe("SENT");
    await expect(cancelCardPayment(buyer, offer.id)).rejects.toBeInstanceOf(InvalidState);
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
    await dispatchWebhook(event, held);
    await dispatchWebhook(event, held);
    const funded = await getOffer(buyer, offer.id);
    expect(funded.status).toBe("ACTIVE");
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
});
