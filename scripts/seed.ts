import { compare, hash } from "bcryptjs";
import { describeLogin } from "@/lib/airwallex/client";
import { isDuplicateRequest } from "@/lib/airwallex/errors";
import { readString } from "@/lib/airwallex/json";
import { seedTopUpRequestId } from "@/lib/airwallex/requestIds";
import { createConnectedAccountTransfer, retrieveConnectedAccountTransfer } from "@/lib/airwallex/wallet";
import { getServerConfig } from "@/lib/config";
import { connectDb, disconnectDb } from "@/lib/db";
import { fromAwxAmount } from "@/lib/money";
import { PlatformSettings } from "@/models/platformSettings";
import { User } from "@/models/user";
import { REVENUE_USER, SEED_USERS, type SeedUserSpec } from "./seed-data/users";
import { seedOffers } from "./seed-offers";
import { runProvisioning } from "@/services/provisioning";

const BCRYPT_COST = 10;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitUntilSettled(transferId: string): Promise<void> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const latest = await retrieveConnectedAccountTransfer(transferId);
    const status = readString(latest, "status") ?? "";
    if (status === "SETTLED") return;
    if (status === "FAILED" || status === "SUSPENDED") {
      throw new Error(`Seed top-up ${transferId} is ${status}.`);
    }
    await sleep(2_000);
  }
  throw new Error(`Seed top-up ${transferId} did not settle within 20s.`);
}

async function passwordHash(email: string, plaintext: string): Promise<string> {
  const existing = await User.findOne({ email });
  if (existing && (await compare(plaintext, existing.passwordHash))) return existing.passwordHash;
  return hash(plaintext, BCRYPT_COST);
}

async function upsertRevenue(): Promise<string> {
  const passwordHashValue = await passwordHash(REVENUE_USER.email, "revenue-no-login");
  const user = await User.findOneAndUpdate(
    { email: REVENUE_USER.email },
    {
      $set: {
        email: REVENUE_USER.email,
        passwordHash: passwordHashValue,
        name: REVENUE_USER.name,
        headline: REVENUE_USER.headline,
        avatarColor: REVENUE_USER.avatarColor,
        kind: "REVENUE",
        isGuestPool: false,
      },
      $unset: { demoRole: "" },
      $setOnInsert: {
        airwallex: { provisioning: { step: "NONE", updatedAt: new Date() } },
      },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  );
  return user._id.toString();
}

async function upsertSeedUser(spec: SeedUserSpec, plaintext: string): Promise<string> {
  const passwordHashValue = await passwordHash(spec.email, plaintext);
  const user = await User.findOneAndUpdate(
    { email: spec.email },
    {
      $set: {
        email: spec.email,
        passwordHash: passwordHashValue,
        name: spec.name,
        headline: spec.headline,
        avatarColor: spec.avatarColor,
        kind: "SEED",
        isGuestPool: true,
        demoRole: spec.role,
      },
      $setOnInsert: {
        airwallex: { provisioning: { step: "NONE", updatedAt: new Date() } },
      },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  );
  return user._id.toString();
}

async function requireReady(userId: string, label: string) {
  const user = await runProvisioning(userId);
  if (user.airwallex.provisioning.step !== "READY" || !user.airwallex.accountId) {
    throw new Error(`${label} did not finish provisioning: ${user.airwallex.provisioning.lastError ?? user.airwallex.provisioning.step}`);
  }
  return user;
}

async function topUp(userId: string, accountId: string, major: number, seedVersion: number, currency: string): Promise<void> {
  const requestId = seedTopUpRequestId(userId, seedVersion);
  try {
    const transfer = await createConnectedAccountTransfer({
      amountMinor: fromAwxAmount(major, currency),
      currency,
      destination: accountId,
      requestId,
      reason: "professional_business_services",
      reference: "Seed buyer top-up",
    });
    const transferId = readString(transfer, "id");
    if (!transferId) throw new Error(`Seed top-up for ${userId} did not return an id.`);
    await waitUntilSettled(transferId);
  } catch (error) {
    if (!isDuplicateRequest(error)) throw error;
    console.log(`Seed top-up ${requestId} was already sent.`);
  }
}

async function main(): Promise<void> {
  // DEMO-ONLY: Creates sandbox connected accounts and moves sandbox wallet money for the demo personas.
  // PROD: No seed script. Accounts come from real onboarding; balances come from real payments.
  const config = getServerConfig();
  await connectDb();
  try {
    const login = await describeLogin();
    console.log(`Airwallex login ok (token expires in ${login.expiresInSeconds}s).`);
  } catch (error) {
    console.error("Airwallex login failed. Check AIRWALLEX_CLIENT_ID and AIRWALLEX_API_KEY in .env.local.");
    throw error;
  }

  const revenueId = await upsertRevenue();
  const revenue = await requireReady(revenueId, REVENUE_USER.email);
  const revenueAccountId = revenue.airwallex.accountId;
  if (!revenueAccountId) throw new Error("Revenue account id missing after provisioning.");

  const existing = await PlatformSettings.findById("default");
  const settings = existing
    ? await PlatformSettings.findByIdAndUpdate(
        "default",
        { $set: { revenueUserId: revenue._id, revenueAccountId, lastSeededAt: new Date() } },
        { returnDocument: "after" },
      )
    : await PlatformSettings.create({
        _id: "default",
        revenueUserId: revenue._id,
        revenueAccountId,
        seedVersion: 1,
        lastSeededAt: new Date(),
      });
  if (!settings) throw new Error("platform_settings could not be saved.");

  const rows: string[] = [`${REVENUE_USER.email}  ${revenueAccountId}  READY`];
  for (const spec of SEED_USERS) {
    const userId = await upsertSeedUser(spec, config.seedPassword);
    const user = await requireReady(userId, spec.email);
    const accountId = user.airwallex.accountId;
    if (!accountId) throw new Error(`${spec.email} has no account id.`);
    if (spec.extraTopUpMajor > 0) {
      await topUp(userId, accountId, spec.extraTopUpMajor, settings.seedVersion, config.currency);
    }
    rows.push(`${spec.email}  ${accountId}  READY  top-up ${spec.extraTopUpMajor}`);
  }

  const offerRows = await seedOffers();
  console.log("Seeded users:");
  for (const row of rows) console.log(`  ${row}`);
  console.log("Seeded offers:");
  for (const row of offerRows) console.log(`  ${row}`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => disconnectDb());
