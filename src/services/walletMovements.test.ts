/**
 * @vitest-environment node
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { resetServerConfigCache } from "@/lib/config";
import { connectDb, disconnectDb } from "@/lib/db";
import { User, type UserDocument } from "@/models/user";
import { InsufficientBalance, InvalidState, NotFound } from "@/server/errors";
import { sendFunds, withdrawToBank, type MovementGateway } from "@/services/walletMovements";

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

async function readyUser(email: string, name: string, kind: "REGULAR" | "REVENUE" = "REGULAR"): Promise<UserDocument> {
  return User.create({
    email,
    name,
    passwordHash: "unused",
    avatarColor: "#57534E",
    kind,
    isGuestPool: false,
    airwallex: {
      accountId: `acct_${email}`,
      accountStatus: "ACTIVE",
      provisioning: { step: "READY", updatedAt: new Date() },
    },
  });
}

function gateway(overrides: Partial<MovementGateway> = {}): MovementGateway & {
  payouts: Parameters<MovementGateway["createPayout"]>[0][];
  charges: Parameters<MovementGateway["createCharge"]>[0][];
  transfers: Parameters<MovementGateway["createConnectedAccountTransfer"]>[0][];
} {
  const payouts: Parameters<MovementGateway["createPayout"]>[0][] = [];
  const charges: Parameters<MovementGateway["createCharge"]>[0][] = [];
  const transfers: Parameters<MovementGateway["createConnectedAccountTransfer"]>[0][] = [];
  return {
    currentBalances: async () => [{ currency: "USD", available_amount: 100, pending_amount: 0, reserved_amount: 0 }],
    createCharge: async (input) => {
      charges.push(input);
      return { id: "ch_1", status: "SETTLED" };
    },
    retrieveCharge: async () => ({ id: "ch_1", status: "SETTLED" }),
    createConnectedAccountTransfer: async (input) => {
      transfers.push(input);
      return { id: "cat_1", status: "SETTLED" };
    },
    createPayout: async (input) => {
      payouts.push(input);
      return { id: "tr_1" };
    },
    wait: async () => {},
    payouts,
    charges,
    transfers,
    ...overrides,
  };
}

describe("withdrawToBank", () => {
  it("pays the sandbox bank from the user's connected account", async () => {
    const user = await readyUser("sam@example.com", "Sam Rivera");
    const fake = gateway();
    const result = await withdrawToBank(user, { amount: "12.50" }, fake);
    expect(result).toEqual({ ok: true, transferId: "tr_1" });
    expect(fake.payouts[0]).toMatchObject({
      amountMinor: 1_250,
      currency: "USD",
      onBehalfOf: "acct_sam@example.com",
      reference: "Sandbox withdrawal",
      relatedUserId: user._id.toString(),
    });
    expect(fake.payouts[0]?.requestId.startsWith("wd:")).toBe(true);
  });

  it("refuses a withdrawal above the available balance", async () => {
    const user = await readyUser("sam@example.com", "Sam Rivera");
    await expect(withdrawToBank(user, { amount: "100.01" }, gateway())).rejects.toBeInstanceOf(InsufficientBalance);
  });
});

describe("sendFunds", () => {
  it("charges the sender and transfers the same amount to the recipient", async () => {
    const sender = await readyUser("sam@example.com", "Sam Rivera");
    const recipient = await readyUser("maya@example.com", "Maya Chen");
    const fake = gateway();
    await expect(sendFunds(sender, { recipientId: recipient._id.toString(), amount: "20.00" }, fake)).resolves.toEqual({
      ok: true,
    });
    expect(fake.charges[0]).toMatchObject({
      amountMinor: 2_000,
      source: "acct_sam@example.com",
      reason: "professional_business_services",
      reference: "Send to Maya Chen",
    });
    expect(fake.transfers).toEqual([
      expect.objectContaining({
        amountMinor: 2_000,
        destination: "acct_maya@example.com",
        reason: "professional_business_services",
      }),
    ]);
    expect(fake.charges[0]?.requestId.startsWith("sch:")).toBe(true);
    expect(fake.transfers[0]?.requestId.startsWith("sxf:")).toBe(true);
  });

  it("waits for a pending charge to settle before transferring", async () => {
    const sender = await readyUser("sam@example.com", "Sam Rivera");
    const recipient = await readyUser("maya@example.com", "Maya Chen");
    let retrieves = 0;
    const fake = gateway({
      createCharge: async (input) => {
        fake.charges.push(input);
        return { id: "ch_pending", status: "PENDING" };
      },
      retrieveCharge: async () => {
        retrieves += 1;
        return { id: "ch_pending", status: "SETTLED" };
      },
    });
    await sendFunds(sender, { recipientId: recipient._id.toString(), amount: "5.00" }, fake);
    expect(retrieves).toBe(1);
    expect(fake.transfers).toHaveLength(1);
  });

  it("returns the amount when the recipient transfer fails", async () => {
    const sender = await readyUser("sam@example.com", "Sam Rivera");
    const recipient = await readyUser("maya@example.com", "Maya Chen");
    const fake = gateway({
      createConnectedAccountTransfer: async (input) => {
        fake.transfers.push(input);
        if (input.destination === recipient.airwallex.accountId) throw new Error("destination down");
        return { id: "cat_back", status: "SETTLED" };
      },
    });
    await expect(sendFunds(sender, { recipientId: recipient._id.toString(), amount: "5.00" }, fake)).rejects.toThrow(
      /returned to your wallet/,
    );
    expect(fake.transfers.map((item) => item.destination)).toEqual(["acct_maya@example.com", "acct_sam@example.com"]);
    expect(fake.transfers[1]?.requestId.startsWith("srt:")).toBe(true);
  });

  it("says the amount may still be on the platform when the return also fails", async () => {
    const sender = await readyUser("sam@example.com", "Sam Rivera");
    const recipient = await readyUser("maya@example.com", "Maya Chen");
    const fake = gateway({
      createConnectedAccountTransfer: async () => {
        throw new Error("down");
      },
    });
    await expect(sendFunds(sender, { recipientId: recipient._id.toString(), amount: "5.00" }, fake)).rejects.toThrow(
      /platform account/,
    );
  });

  it("rejects self, the revenue account, and a low balance", async () => {
    const sender = await readyUser("sam@example.com", "Sam Rivera");
    const revenue = await readyUser("revenue@example.com", "Platform Revenue", "REVENUE");
    const fake = gateway();
    await expect(sendFunds(sender, { recipientId: sender._id.toString(), amount: "5.00" }, fake)).rejects.toBeInstanceOf(
      InvalidState,
    );
    await expect(sendFunds(sender, { recipientId: revenue._id.toString(), amount: "5.00" }, fake)).rejects.toBeInstanceOf(
      NotFound,
    );
    await expect(sendFunds(sender, { recipientId: "not-an-id", amount: "5.00" }, fake)).rejects.toBeInstanceOf(NotFound);
    await expect(
      sendFunds(sender, { recipientId: (await readyUser("maya@example.com", "Maya Chen"))._id.toString(), amount: "500.00" }, fake),
    ).rejects.toBeInstanceOf(InsufficientBalance);
    expect(fake.charges).toHaveLength(0);
  });

  it("does not transfer when the charge fails", async () => {
    const sender = await readyUser("sam@example.com", "Sam Rivera");
    const recipient = await readyUser("maya@example.com", "Maya Chen");
    const fake = gateway({
      createCharge: async () => ({ id: "ch_bad", status: "FAILED" }),
    });
    await expect(sendFunds(sender, { recipientId: recipient._id.toString(), amount: "5.00" }, fake)).rejects.toBeInstanceOf(
      InvalidState,
    );
    expect(fake.transfers).toHaveLength(0);
  });
});
