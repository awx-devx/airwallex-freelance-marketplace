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
type ChecklistStep = "ACCOUNT_CREATED" | "SUBMITTED" | "ACTIVE" | "WELCOME_CREDITED" | "READY";
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

function needsSubmitRetry(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return message.toLowerCase().includes("submitted");
}

async function forceUntilActive(client: ProvisioningClient, accountId: string): Promise<"ACTIVE"> {
  const deadline = Date.now() + 20_000;
  let last: unknown;
  while (Date.now() < deadline) {
    try {
      const activated = await client.forceAccountStatus(accountId);
      const next = knownStatus(accountStatusOf(activated));
      if (next === "ACTIVE") return "ACTIVE";
      const retrieved = knownStatus(accountStatusOf(await client.retrieveAccount(accountId)));
      if (retrieved === "ACTIVE") return "ACTIVE";
      last = new Error(`Connected account ${accountId} did not become ACTIVE (status ${next ?? retrieved ?? "unknown"}).`);
    } catch (error) {
      last = error;
      if (!needsSubmitRetry(error)) throw error;
    }
    await sleep(2_000);
  }
  if (last instanceof Error) throw last;
  throw new Error(`Connected account ${accountId} did not become ACTIVE.`);
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
    {
      $set: { ...fields, "airwallex.provisioning.updatedAt": new Date() },
      $unset: { "airwallex.provisioning.lastError": "", "airwallex.provisioning.failedStep": "" },
    },
    { returnDocument: "after" },
  );
  if (!user) throw new Error("User disappeared during provisioning.");
  return user;
}

export function provisioningErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "Provisioning failed.";
  if (message.toLowerCase().includes("submitted for review")) {
    return "Airwallex wasn't ready to activate the account yet. Retry, and we'll continue from this step.";
  }
  return message;
}

async function fail(userId: string, error: unknown, failedStep: ChecklistStep): Promise<UserDocument> {
  const user = await User.findByIdAndUpdate(
    userId,
    {
      $set: {
        "airwallex.provisioning.step": "FAILED",
        "airwallex.provisioning.failedStep": failedStep,
        "airwallex.provisioning.lastError": provisioningErrorMessage(error),
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
  if (initial.airwallex.provisioning.step === "READY") return initial;
  if (running.has(userId)) return (await User.findById(userId)) ?? initial;

  const progress: { step: ChecklistStep } = { step: "ACCOUNT_CREATED" };
  running.add(userId);
  try {
    return await withAirwallexContext({ relatedUserId: userId }, () => advance(initial, client, progress));
  } catch (error) {
    return fail(userId, error, progress.step);
  } finally {
    running.delete(userId);
  }
}

async function advance(
  start: UserDocument,
  client: ProvisioningClient,
  progress: { step: ChecklistStep },
): Promise<UserDocument> {
  let user = start;
  const userId = user._id.toString();
  let accountId = user.airwallex.accountId;
  let status = user.airwallex.accountStatus;

  progress.step = "ACCOUNT_CREATED";
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

  progress.step = "SUBMITTED";
  if (status !== "SUBMITTED" && status !== "ACTIVE") {
    const submitted = await client.submitAccount(accountId);
    status = knownStatus(accountStatusOf(submitted)) ?? "SUBMITTED";
    user = await save(userId, {
      "airwallex.accountStatus": status,
      "airwallex.provisioning.step": "SUBMITTED",
    });
  }

  progress.step = "ACTIVE";
  if (status !== "ACTIVE") {
    const current = knownStatus(accountStatusOf(await client.retrieveAccount(accountId)));
    // SANDBOX: simulation/update_status can reject a just-submitted account for a few seconds.
    // https://www.airwallex.com/docs/developer-tools/sandbox-environment/connected-accounts/simulate-connected-account-status-transition
    status = current === "ACTIVE" ? "ACTIVE" : await forceUntilActive(client, accountId);
    user = await save(userId, {
      "airwallex.accountStatus": "ACTIVE",
      "airwallex.provisioning.step": "ACTIVE",
    });
  }

  progress.step = "WELCOME_CREDITED";
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

  progress.step = "READY";
  if (user.kind === "REGULAR") {
    await createWelcomeOffer(userId);
  }

  return save(userId, { "airwallex.provisioning.step": "READY" });
}
