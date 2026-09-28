/**
 * @vitest-environment node
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { MeSchema } from "@/contracts/users";
import { resetServerConfigCache } from "@/lib/config";
import { connectDb, disconnectDb } from "@/lib/db";
import { User } from "@/models/user";
import { EmailTaken, InvalidCredentials } from "@/server/errors";
import { guestLogin, login, searchUsers, signup } from "@/services/auth";

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
  await User.deleteMany({});
});

describe("auth service", () => {
  it("signs up a regular user at provisioning step NONE", async () => {
    const me = await signup({ name: "Maya Chen", email: "Maya@Example.com", password: "demo1234", headline: "Designer" });
    expect(MeSchema.parse(me)).toMatchObject({
      email: "maya@example.com",
      kind: "REGULAR",
      isGuest: false,
      provisioning: { step: "NONE" },
      initials: "MC",
    });
    const stored = await User.findOne({ email: "maya@example.com" });
    expect(stored?.passwordHash).not.toBe("demo1234");
  });

  it("rejects a duplicate email", async () => {
    await signup({ name: "Maya", email: "maya@example.com", password: "demo1234" });
    await expect(signup({ name: "Other", email: "maya@example.com", password: "other-pass" })).rejects.toBeInstanceOf(EmailTaken);
  });

  it("logs in with the password and rejects a wrong one", async () => {
    await signup({ name: "Maya Chen", email: "maya@example.com", password: "demo1234" });
    const me = await login({ email: "maya@example.com", password: "demo1234" });
    expect(me.email).toBe("maya@example.com");
    await expect(login({ email: "maya@example.com", password: "nope" })).rejects.toBeInstanceOf(InvalidCredentials);
    await expect(login({ email: "missing@example.com", password: "demo1234" })).rejects.toBeInstanceOf(InvalidCredentials);
  });

  it("picks a ready guest and refuses an empty pool", async () => {
    await expect(guestLogin()).rejects.toMatchObject({ code: "INTERNAL" });
    await User.create({
      email: "sam@demo.test",
      passwordHash: "unused",
      name: "Sam Rivera",
      avatarColor: "#0EA5E9",
      kind: "SEED",
      isGuestPool: true,
      demoRole: "Buyer",
      airwallex: { accountId: "acct_sam", accountStatus: "ACTIVE", provisioning: { step: "READY", updatedAt: new Date() } },
    });
    const me = await guestLogin();
    expect(me).toMatchObject({ email: "sam@demo.test", isGuest: true, kind: "SEED" });
  });

  it("searches ready users and skips self, revenue, and unfinished accounts", async () => {
    const self = await signup({ name: "Maya Chen", email: "maya@example.com", password: "demo1234" });
    await User.create({
      email: "sam@demo.test",
      passwordHash: "unused",
      name: "Sam Rivera",
      avatarColor: "#0EA5E9",
      kind: "SEED",
      isGuestPool: true,
      demoRole: "Buyer",
      airwallex: { accountStatus: "ACTIVE", provisioning: { step: "READY", updatedAt: new Date() } },
    });
    await User.create({
      email: "revenue@demo.test",
      passwordHash: "unused",
      name: "Platform Revenue",
      avatarColor: "#44403C",
      kind: "REVENUE",
      isGuestPool: false,
      airwallex: { provisioning: { step: "READY", updatedAt: new Date() } },
    });
    await User.create({
      email: "leo@demo.test",
      passwordHash: "unused",
      name: "Leo Okafor",
      avatarColor: "#0F766E",
      kind: "SEED",
      isGuestPool: true,
      airwallex: { provisioning: { step: "NONE", updatedAt: new Date() } },
    });

    const matches = await searchUsers(self.id, "sam");
    expect(matches.map((user) => user.name)).toEqual(["Sam Rivera"]);
    await expect(searchUsers(self.id, "rev")).resolves.toEqual([]);
  });
});
