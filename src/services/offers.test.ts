/**
 * @vitest-environment node
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { OfferSchema } from "@/contracts/offers";
import { resetServerConfigCache } from "@/lib/config";
import { connectDb, disconnectDb } from "@/lib/db";
import { Activity } from "@/models/activity";
import { Offer } from "@/models/offer";
import { User, type UserDocument } from "@/models/user";
import { Forbidden, InvalidState, NotFound, ProvisioningIncomplete } from "@/server/errors";
import { createAndSend, declineOffer, getOffer, listActivity, listOffers, requestChanges, submitDelivery, withdrawOffer } from "@/services/offers";

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
  await Promise.all([User.deleteMany({}), Offer.deleteMany({}), Activity.deleteMany({})]);
});

async function readyUser(email: string, name: string, step: "READY" | "NONE" = "READY"): Promise<UserDocument> {
  return User.create({
    email,
    name,
    passwordHash: "unused",
    avatarColor: "#57534E",
    kind: "REGULAR",
    isGuestPool: false,
    airwallex: {
      accountId: step === "READY" ? `acct_${email}` : undefined,
      accountStatus: step === "READY" ? "ACTIVE" : undefined,
      provisioning: { step, updatedAt: new Date() },
    },
  });
}

const input = {
  title: "Landing page",
  description: "A small marketing site.",
  milestones: [{ title: "Design", description: "Homepage", amount: "100.00", dueDate: "2026-10-12" }],
};

describe("offers", () => {
  it("sends an offer with a fee snapshot and lists it for each party", async () => {
    const seller = await readyUser("maya@example.com", "Maya Chen");
    const buyer = await readyUser("sam@example.com", "Sam Rivera");
    const offer = await createAndSend(seller, { ...input, buyerId: buyer._id.toString() });

    expect(OfferSchema.parse(offer)).toMatchObject({
      status: "SENT",
      viewerRole: "SELLER",
      total: { amountMinor: 10_000, currency: "USD" },
      feeSnapshot: { platformFeePercent: 10, processingReservePercent: 2 },
      allowedActions: ["WITHDRAW"],
      milestones: [
        {
          title: "Design",
          dueDate: "2026-10-12",
          status: "PENDING_FUNDING",
          amount: { amountMinor: 10_000, currency: "USD" },
          breakdown: {
            seller: { amountMinor: 9_000 },
            revenue: { amountMinor: 800 },
            reserve: { amountMinor: 200 },
            fee: { amountMinor: 1_000 },
          },
        },
      ],
    });

    const incoming = await listOffers(buyer, "incoming");
    expect(incoming.map((item) => item.shortRef)).toEqual([offer.shortRef]);
    expect(incoming[0]?.viewerRole).toBe("BUYER");
    expect(incoming[0]?.counterparty.name).toBe("Maya Chen");
    expect(await listOffers(buyer, "buying")).toEqual([]);
    expect(await listOffers(seller, "selling")).toHaveLength(1);

    const activity = await listActivity(buyer, offer.id);
    expect(activity.map((item) => item.type)).toEqual(["OFFER_SENT"]);
    expect(activity[0]?.message).toBe("Maya Chen sent the offer");
  });

  it("rejects an unfinished seller, yourself, and a buyer who is not ready", async () => {
    const seller = await readyUser("maya@example.com", "Maya Chen", "NONE");
    const buyer = await readyUser("sam@example.com", "Sam Rivera");
    await expect(createAndSend(seller, { ...input, buyerId: buyer._id.toString() })).rejects.toBeInstanceOf(ProvisioningIncomplete);

    const ready = await readyUser("leo@example.com", "Leo Okafor");
    await expect(createAndSend(ready, { ...input, buyerId: ready._id.toString() })).rejects.toMatchObject({
      status: 422,
      fieldErrors: { buyerId: ["You can't send an offer to yourself."] },
    });
    const unfinished = await readyUser("new@example.com", "New Buyer", "NONE");
    await expect(createAndSend(ready, { ...input, buyerId: unfinished._id.toString() })).rejects.toMatchObject({
      fieldErrors: { buyerId: ["Choose a buyer who can receive offers."] },
    });
  });

  it("lets the buyer decline and the seller withdraw, and refuses the other party", async () => {
    const seller = await readyUser("maya@example.com", "Maya Chen");
    const buyer = await readyUser("sam@example.com", "Sam Rivera");
    const stranger = await readyUser("aiko@example.com", "Aiko Tanaka");
    const sent = await createAndSend(seller, { ...input, buyerId: buyer._id.toString() });

    await expect(getOffer(stranger, sent.id)).rejects.toBeInstanceOf(Forbidden);
    await expect(getOffer(buyer, "not-an-offer")).rejects.toBeInstanceOf(NotFound);
    await expect(declineOffer(seller, sent.id)).rejects.toBeInstanceOf(InvalidState);

    const declined = await declineOffer(buyer, sent.id);
    expect(declined.status).toBe("DECLINED");
    expect(declined.allowedActions).toEqual([]);
    await expect(declineOffer(buyer, sent.id)).rejects.toBeInstanceOf(InvalidState);
    expect(await listOffers(buyer, "incoming")).toEqual([]);

    const another = await createAndSend(seller, { ...input, title: "Second offer", buyerId: buyer._id.toString() });
    await expect(withdrawOffer(buyer, another.id)).rejects.toBeInstanceOf(InvalidState);
    const withdrawn = await withdrawOffer(seller, another.id);
    expect(withdrawn.status).toBe("WITHDRAWN");
  });

  it("records a delivery and a change request once the milestone is funded", async () => {
    const seller = await readyUser("maya@example.com", "Maya Chen");
    const buyer = await readyUser("sam@example.com", "Sam Rivera");
    const sent = await createAndSend(seller, { ...input, buyerId: buyer._id.toString() });
    const milestoneId = sent.milestones[0]?.id ?? "";
    await expect(submitDelivery(seller, sent.id, milestoneId, { links: ["https://example.com/design"] })).rejects.toBeInstanceOf(InvalidState);

    await Offer.updateOne({ _id: sent.id }, { $set: { status: "ACTIVE", "milestones.0.status": "FUNDED" } });
    const submitted = await submitDelivery(seller, sent.id, milestoneId, {
      links: ["https://example.com/design"],
      note: "First pass",
    });
    expect(submitted.milestones[0]).toMatchObject({
      status: "SUBMITTED",
      deliveries: [{ links: ["https://example.com/design"], note: "First pass" }],
    });
    expect(submitted.viewerRole).toBe("SELLER");

    const reviewed = await requestChanges(buyer, sent.id, milestoneId, { comment: "Please add the mobile layout." });
    expect(reviewed.milestones[0]?.status).toBe("CHANGES_REQUESTED");
    expect(reviewed.milestones[0]?.deliveries[0]?.review).toMatchObject({
      decision: "CHANGES_REQUESTED",
      comment: "Please add the mobile layout.",
    });
    expect(reviewed.viewerRole).toBe("BUYER");
    const asSeller = await getOffer(seller, sent.id);
    expect(asSeller.nextAction).toEqual({ label: "Deliver Milestone 1", milestoneId });

    const again = await submitDelivery(seller, sent.id, milestoneId, { links: ["https://example.com/design-v2"] });
    expect(again.milestones[0]?.deliveries).toHaveLength(2);
    expect(again.milestones[0]?.status).toBe("SUBMITTED");

    const activity = await listActivity(buyer, sent.id);
    expect(activity.map((item) => item.type)).toEqual(["OFFER_SENT", "DELIVERY_SUBMITTED", "CHANGES_REQUESTED", "DELIVERY_SUBMITTED"]);
    expect(activity[2]?.milestoneId).toBe(milestoneId);
  });

  it("holds the next delivery until the previous milestone is paid when sequential", async () => {
    process.env.SEQUENTIAL_MILESTONES = "true";
    resetServerConfigCache();
    try {
      const seller = await readyUser("maya@example.com", "Maya Chen");
      const buyer = await readyUser("sam@example.com", "Sam Rivera");
      const sent = await createAndSend(seller, {
        ...input,
        buyerId: buyer._id.toString(),
        milestones: [
          { title: "Design", description: "Homepage", amount: "100.00", dueDate: "2026-10-12" },
          { title: "Build", description: "Pages", amount: "50.00", dueDate: "2026-10-20" },
        ],
      });
      await Offer.updateOne(
        { _id: sent.id },
        { $set: { status: "ACTIVE", "milestones.0.status": "FUNDED", "milestones.1.status": "FUNDED" } },
      );
      const funded = await getOffer(seller, sent.id);
      expect(funded.milestones[0]?.allowedActions).toContain("SUBMIT_DELIVERY");
      expect(funded.milestones[1]?.allowedActions).not.toContain("SUBMIT_DELIVERY");
      const secondId = sent.milestones[1]?.id ?? "";
      await expect(submitDelivery(seller, sent.id, secondId, { links: ["https://example.com/build"] })).rejects.toBeInstanceOf(
        InvalidState,
      );

      await Offer.updateOne({ _id: sent.id }, { $set: { "milestones.0.status": "PAID" } });
      const delivered = await submitDelivery(seller, sent.id, secondId, { links: ["https://example.com/build"] });
      expect(delivered.milestones[1]?.status).toBe("SUBMITTED");
    } finally {
      delete process.env.SEQUENTIAL_MILESTONES;
      resetServerConfigCache();
    }
  });
});
