/**
 * @vitest-environment node
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import type { JsonObject } from "@/lib/airwallex/json";
import { resetServerConfigCache } from "@/lib/config";
import { connectDb, disconnectDb } from "@/lib/db";
import { Activity } from "@/models/activity";
import { Offer } from "@/models/offer";
import { PlatformSettings } from "@/models/platformSettings";
import { User } from "@/models/user";
import { runProvisioning, type ProvisioningClient } from "@/services/provisioning";

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
  await Promise.all([User.deleteMany({}), Offer.deleteMany({}), Activity.deleteMany({}), PlatformSettings.deleteMany({})]);
});

function fakeClient(overrides: Partial<ProvisioningClient> = {}): ProvisioningClient & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async createAccount(body) {
      calls.push(`create:${String(body.identifier)}`);
      return { id: `acct_${String(body.identifier)}`, status: "CREATED" };
    },
    async submitAccount(accountId) {
      calls.push(`submit:${accountId}`);
      return { id: accountId, status: "SUBMITTED" };
    },
    async forceAccountStatus(accountId) {
      calls.push(`force:${accountId}`);
      return { id: accountId, status: "ACTIVE" };
    },
    async retrieveAccount(accountId) {
      return { id: accountId, status: "ACTIVE" };
    },
    async createTransfer(input) {
      calls.push(`transfer:${input.requestId}:${input.amountMinor}`);
      return { id: "tr_welcome", status: "SETTLED" } satisfies JsonObject;
    },
    async retrieveTransfer() {
      return { id: "tr_welcome", status: "SETTLED" };
    },
    ...overrides,
  };
}

async function user(fields: Record<string, unknown>) {
  return User.create({
    passwordHash: "unused",
    avatarColor: "#57534E",
    isGuestPool: false,
    ...fields,
  });
}

describe("runProvisioning", () => {
  it("activates a revenue account without a credit or a welcome offer", async () => {
    const revenue = await user({ email: "revenue@demo.test", name: "Platform Revenue", kind: "REVENUE" });
    const client = fakeClient();
    const ready = await runProvisioning(revenue._id.toString(), client);
    expect(ready.airwallex.provisioning.step).toBe("READY");
    expect(ready.airwallex.accountId).toBe("acct_revenue");
    expect(client.calls.some((call) => call.startsWith("transfer:"))).toBe(false);
    expect(await Offer.countDocuments()).toBe(0);
  });

  it("credits a signup and creates a welcome offer from a ready seed seller", async () => {
    await user({
      email: "maya@demo.test",
      name: "Maya Chen",
      kind: "SEED",
      demoRole: "Seller",
      airwallex: { accountId: "acct_maya", accountStatus: "ACTIVE", provisioning: { step: "READY", updatedAt: new Date() } },
    });
    const buyer = await user({ email: "new@example.com", name: "New Buyer", kind: "REGULAR" });
    const client = fakeClient();
    const ready = await runProvisioning(buyer._id.toString(), client);

    expect(ready.airwallex.provisioning.step, ready.airwallex.provisioning.lastError).toBe("READY");
    expect(ready.airwallex.accountStatus).toBe("ACTIVE");
    expect(client.calls[0]).toBe(`create:${buyer._id.toString()}`);
    expect(client.calls).toContain(`transfer:welcome:${buyer._id.toString()}:500000`);
    const offer = await Offer.findOne({ buyerId: buyer._id, isWelcomeOffer: true });
    expect(offer?.status).toBe("SENT");
    expect(offer?.currency).toBe("USD");
    expect(offer?.milestones.every((milestone) => milestone.status === "PENDING_FUNDING")).toBe(true);
    expect(await Activity.countDocuments({ offerId: offer?._id, type: "OFFER_SENT" })).toBe(1);

    const again = fakeClient();
    await runProvisioning(buyer._id.toString(), again);
    expect(again.calls).toEqual([]);
  });

  it("leaves the signup failed when no seed seller is ready", async () => {
    const buyer = await user({ email: "new@example.com", name: "New Buyer", kind: "REGULAR" });
    const client = fakeClient();
    const failed = await runProvisioning(buyer._id.toString(), client);
    expect(failed.airwallex.provisioning.step).toBe("FAILED");
    expect(failed.airwallex.provisioning.lastError).toMatch(/npm run seed/);
    expect(failed.airwallex.accountId).toBe(`acct_${buyer._id.toString()}`);
  });

  it("resumes from a stored active account without creating another one", async () => {
    await user({
      email: "maya@demo.test",
      name: "Maya Chen",
      kind: "SEED",
      demoRole: "Seller",
      airwallex: { accountId: "acct_maya", accountStatus: "ACTIVE", provisioning: { step: "READY", updatedAt: new Date() } },
    });
    const buyer = await user({
      email: "new@example.com",
      name: "New Buyer",
      kind: "REGULAR",
      airwallex: {
        accountId: "acct_existing",
        accountStatus: "ACTIVE",
        provisioning: { step: "FAILED", lastError: "previous", updatedAt: new Date() },
      },
    });
    const client = fakeClient({
      async createAccount() {
        throw new Error("should not create");
      },
    });
    const ready = await runProvisioning(buyer._id.toString(), client);
    expect(ready.airwallex.accountId).toBe("acct_existing");
    expect(ready.airwallex.provisioning.step, ready.airwallex.provisioning.lastError).toBe("READY");
    expect(ready.airwallex.provisioning.lastError).toBeUndefined();
    expect(client.calls.some((call) => call.startsWith("create:"))).toBe(false);
    expect(client.calls.some((call) => call.startsWith("transfer:"))).toBe(true);
  });

  it("uses the seed version in the connected-account identifier", async () => {
    const seller = await user({ email: "maya@demo.test", name: "Maya Chen", kind: "SEED", demoRole: "Seller" });
    await PlatformSettings.create({
      _id: "default",
      revenueUserId: seller._id,
      revenueAccountId: "acct_revenue",
      seedVersion: 2,
      lastSeededAt: new Date(),
    });
    const client = fakeClient();
    const ready = await runProvisioning(seller._id.toString(), client);
    expect(ready.airwallex.provisioning.step).toBe("READY");
    expect(client.calls[0]).toBe("create:seed-maya-v2");
    expect(await Offer.countDocuments()).toBe(0);
  });
});
