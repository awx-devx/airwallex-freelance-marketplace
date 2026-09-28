import type { JsonObject } from "@/lib/airwallex/json";
import { accountIdOf, accountStatusOf, createAccount, forceAccountStatus, retrieveAccount, submitAccount } from "@/lib/airwallex/accounts";
import { withAirwallexContext } from "@/lib/airwallex/context";
import { readString } from "@/lib/airwallex/json";
import { welcomeCreditRequestId } from "@/lib/airwallex/requestIds";
import { createConnectedAccountTransfer, retrieveConnectedAccountTransfer } from "@/lib/airwallex/wallet";
import { getServerConfig } from "@/lib/config";
import { connectDb } from "@/lib/db";
import { fromAwxAmount } from "@/lib/money";
import { PlatformSettings } from "@/models/platformSettings";
import { User, type UserDocument } from "@/models/user";
import { accountCreateBody, identityForAccount } from "../../scripts/seed-data/identity-fixture";
import { seedIdentifier } from "../../scripts/seed-data/users";
import { createWelcomeOffer } from "@/services/offers";

const ACCOUNT_STATUSES = new Set(["CREATED", "SUBMITTED", "ACTIVE", "ACTION_REQUIRED", "SUSPENDED"]);
const TERMINAL_TRANSFER = new Set(["SETTLED", "FAILED", "SUSPENDED"]);
const running = new Set<string>();

type AccountStatus = UserDocument["airwallex"]["accountStatus"];

export type ProvisioningClient = {
  createAccount: (body: JsonObject) => Promise<JsonObject>;
  submitAccount: (accountId: string) => Promise<JsonObject>;
  forceAccountStatus: (accountId: string) => Promise<JsonObject>;
  retrieveAccount: (accountId: string) => Promise<JsonObject>;
  createTransfer: (input: { destination: string; amountMinor: number; requestId: string; reference: string }) => Promise<JsonObject>;
  retrieveTransfer: (transferId: string) => Promise<JsonObject>;
};

const liveClient: ProvisioningClient = {
  createAccount,
  submitAccount,
  async forceAccountStatus(accountId) {
    return forceAccountStatus(accountId, "ACTIVE", true);
  },
  retrieveAccount,
  async createTransfer(input) {
    const currency = getServerConfig().currency;
    return createConnectedAccountTransfer({
      amountMinor: input.amountMinor,
      currency,
      destination: input.destination,
      requestId: input.requestId,
      reason: "professional_business_services",
      reference: input.reference,
    });
  },
  retrieveTransfer: retrieveConnectedAccountTransfer,
};

function knownStatus(value: string | undefined): AccountStatus | undefined {
  if (value && ACCOUNT_STATUSES.has(value)) return value as NonNullable<AccountStatus>;
  return undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitUntilSettled(client: ProvisioningClient, transferId: string): Promise<void> {
  const deadline = Date.now() + 20_000;
  let latest = await client.retrieveTransfer(transferId);
  while (Date.now() < deadline) {
    const status = readString(latest, "status") ?? "";
    if (status === "SETTLED") return;
    if (status === "FAILED" || status === "SUSPENDED") {
      throw new Error(`Welcome credit transfer ${transferId} is ${status}.`);
    }
    if (TERMINAL_TRANSFER.has(status)) return;
    await sleep(2_000);
    latest = await client.retrieveTransfer(transferId);
  }
  throw new Error(`Welcome credit transfer ${transferId} did not settle within 20s.`);
}

async function save(userId: string, fields: Record<string, unknown>): Promise<UserDocument> {
  const user = await User.findByIdAndUpdate(
    userId,
    { $set: { ...fields, "airwallex.provisioning.updatedAt": new Date() }, $unset: { "airwallex.provisioning.lastError": "" } },
    { returnDocument: "after" },
  );
  if (!user) throw new Error("User disappeared during provisioning.");
  return user;
}

async function fail(userId: string, error: unknown): Promise<UserDocument> {
  const message = error instanceof Error ? error.message : "Provisioning failed.";
  const user = await User.findByIdAndUpdate(
    userId,
    {
      $set: {
        "airwallex.provisioning.step": "FAILED",
        "airwallex.provisioning.lastError": message,
        "airwallex.provisioning.updatedAt": new Date(),
      },
    },
    { returnDocument: "after" },
  );
  if (!user) throw new Error("User disappeared during provisioning.");
  return user;
}

async function identifierFor(user: UserDocument): Promise<string> {
  if (user.kind === "REVENUE") return "revenue";
  if (user.kind === "SEED") {
    const settings = await PlatformSettings.findById("default");
    return seedIdentifier(user.email, settings?.seedVersion ?? 1);
  }
  return user._id.toString();
}

/**
 * Create, submit, and force-activate a business connected account, then credit the wallet.
 * Safe to call again: each step checks what is already stored, and the credit uses a deterministic request id.
 */
export async function runProvisioning(userId: string, client: ProvisioningClient = liveClient): Promise<UserDocument> {
  await connectDb();
  const initial = await User.findById(userId);
  if (!initial) throw new Error("User not found.");
  if (initial.airwallex.provisioning.step === "READY" || running.has(userId)) return initial;

  running.add(userId);
  try {
    return await withAirwallexContext({ relatedUserId: userId }, () => advance(initial, client));
  } catch (error) {
    return fail(userId, error);
  } finally {
    running.delete(userId);
  }
}

async function advance(start: UserDocument, client: ProvisioningClient): Promise<UserDocument> {
  let user = start;
  const userId = user._id.toString();
  let accountId = user.airwallex.accountId;
  let status = user.airwallex.accountStatus;

  if (!accountId) {
    const identity = identityForAccount({
      role: user.kind === "REVENUE" ? "revenue" : "seller",
      email: user.email,
      identifier: await identifierFor(user),
      businessName: user.kind === "REVENUE" ? "Platform Revenue" : user.name,
      personName: user.name,
    });
    // DEMO-ONLY: Fixture business identity, with Airwallex terms agreed on the user's behalf.
    // PROD: Collect real identity and consent via Hosted Onboarding or Embedded KYC, and handle RFIs.
    const created = await client.createAccount(accountCreateBody(identity));
    accountId = accountIdOf(created);
    if (!accountId) throw new Error("Airwallex did not return a connected account id.");
    status = knownStatus(accountStatusOf(created)) ?? "CREATED";
    user = await save(userId, {
      "airwallex.accountId": accountId,
      "airwallex.accountStatus": status,
      "airwallex.provisioning.step": "ACCOUNT_CREATED",
    });
  }

  if (status !== "SUBMITTED" && status !== "ACTIVE") {
    const submitted = await client.submitAccount(accountId);
    status = knownStatus(accountStatusOf(submitted)) ?? "SUBMITTED";
    user = await save(userId, {
      "airwallex.accountStatus": status,
      "airwallex.provisioning.step": "SUBMITTED",
    });
  }

  if (status !== "ACTIVE") {
    // SANDBOX: force-activates the connected account, skipping KYC review.
    const activated = await client.forceAccountStatus(accountId);
    status = knownStatus(accountStatusOf(activated)) ?? knownStatus(accountStatusOf(await client.retrieveAccount(accountId)));
    if (status !== "ACTIVE") throw new Error(`Connected account ${accountId} did not become ACTIVE (status ${status ?? "unknown"}).`);
    user = await save(userId, {
      "airwallex.accountStatus": "ACTIVE",
      "airwallex.provisioning.step": "ACTIVE",
    });
  }

  if (user.kind !== "REVENUE" && user.airwallex.provisioning.step !== "WELCOME_CREDITED" && user.airwallex.provisioning.step !== "READY") {
    const config = getServerConfig();
    const transfer = await client.createTransfer({
      destination: accountId,
      amountMinor: fromAwxAmount(config.welcomeCreditAmount, config.currency),
      requestId: welcomeCreditRequestId(userId),
      reference: "Welcome credit",
    });
    const transferId = readString(transfer, "id");
    if (!transferId) throw new Error("Welcome credit transfer did not return an id.");
    await waitUntilSettled(client, transferId);
    user = await save(userId, { "airwallex.provisioning.step": "WELCOME_CREDITED" });
  }

  if (user.kind === "REGULAR") {
    await createWelcomeOffer(userId);
  }

  return save(userId, { "airwallex.provisioning.step": "READY" });
}
