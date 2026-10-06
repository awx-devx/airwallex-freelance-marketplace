import { createHash } from "node:crypto";
import { Types } from "mongoose";
import { OkSchema, type OkDTO } from "@/contracts/common";
import { WithdrawalResultSchema, type SendFundsInput, type WithdrawalInput, type WithdrawalResult } from "@/contracts/wallet";
import { readString, type JsonObject } from "@/lib/airwallex/json";
import { createPayoutTransfer } from "@/lib/airwallex/payouts";
import {
  sendChargeRequestId,
  sendReturnRequestId,
  sendTransferRequestId,
  withdrawalRequestId,
} from "@/lib/airwallex/requestIds";
import {
  createCharge,
  createConnectedAccountTransfer,
  currentBalances,
  retrieveCharge,
  type ScaleReason,
} from "@/lib/airwallex/wallet";
import { getServerConfig } from "@/lib/config";
import { connectDb } from "@/lib/db";
import { fromAwxAmount } from "@/lib/money";
import { User, type UserDocument } from "@/models/user";
import { InsufficientBalance, InvalidState, NotFound } from "@/server/errors";
import { mapBalances } from "@/services/wallet";

const SEND_REASON: ScaleReason = "professional_business_services";
const SETTLE_ATTEMPTS = 6;
const SETTLE_WAIT_MS = 2_000;

type ChargeInput = Parameters<typeof createCharge>[0];
type TransferInput = Parameters<typeof createConnectedAccountTransfer>[0];

export type MovementGateway = {
  currentBalances: (onBehalfOf?: string) => Promise<unknown>;
  createCharge: (input: ChargeInput) => Promise<JsonObject>;
  retrieveCharge: (chargeId: string) => Promise<JsonObject>;
  createConnectedAccountTransfer: (input: TransferInput) => Promise<JsonObject>;
  createPayout: typeof createPayoutTransfer;
  wait: (ms: number) => Promise<void>;
};

const liveGateway: MovementGateway = {
  currentBalances,
  createCharge,
  retrieveCharge,
  createConnectedAccountTransfer,
  createPayout: createPayoutTransfer,
  wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

function movementNonce(userId: string, idempotencyKey: string): string {
  return createHash("sha256").update(`${userId}:${idempotencyKey}`).digest("hex").slice(0, 32);
}

function requireAccount(user: UserDocument): string {
  const accountId = user.airwallex.accountId;
  if (!accountId || user.airwallex.provisioning.step !== "READY") {
    throw new InvalidState("Your Airwallex account isn't ready.");
  }
  return accountId;
}

async function availableMinor(gateway: MovementGateway, accountId: string, currency: string): Promise<number> {
  const balances = mapBalances(await gateway.currentBalances(accountId), currency);
  return balances[0]?.available.amountMinor ?? 0;
}

function parseAmount(amount: string, currency: string): number {
  const minor = fromAwxAmount(amount, currency);
  if (minor <= 0) throw new InsufficientBalance("Wallet balance is too low.");
  return minor;
}

export async function withdrawToBank(
  user: UserDocument,
  input: WithdrawalInput,
  gateway: MovementGateway = liveGateway,
): Promise<WithdrawalResult> {
  await connectDb();
  const accountId = requireAccount(user);
  const currency = getServerConfig().currency;
  const amountMinor = parseAmount(input.amount, currency);
  if ((await availableMinor(gateway, accountId, currency)) < amountMinor) {
    throw new InsufficientBalance("Wallet balance is too low.");
  }

  const created = await gateway.createPayout({
    requestId: withdrawalRequestId(movementNonce(user._id.toString(), input.idempotencyKey)),
    amountMinor,
    currency,
    onBehalfOf: accountId,
    reference: "Sandbox withdrawal",
    relatedUserId: user._id.toString(),
  });
  const transferId = readString(created, "id");
  if (!transferId) {
    if (readString(created, "status") === "PENDING") {
      throw new InvalidState("That withdrawal is already in progress.");
    }
    throw new Error("Airwallex did not return a transfer.");
  }
  return WithdrawalResultSchema.parse({ ok: true, transferId });
}

async function settledCharge(created: JsonObject, gateway: MovementGateway): Promise<void> {
  let current = created;
  for (let attempt = 0; attempt < SETTLE_ATTEMPTS; attempt += 1) {
    const status = readString(current, "status") ?? "PENDING";
    if (status === "SETTLED") return;
    if (status === "FAILED" || status === "SUSPENDED") throw new InvalidState("The wallet transfer failed.");
    const chargeId = readString(current, "id");
    if (!chargeId) throw new Error("Airwallex did not return a charge.");
    await gateway.wait(SETTLE_WAIT_MS);
    current = await gateway.retrieveCharge(chargeId);
  }
  const status = readString(current, "status") ?? "";
  if (status === "SETTLED") return;
  if (status === "FAILED" || status === "SUSPENDED") throw new InvalidState("The wallet transfer failed.");
  throw new InvalidState("The wallet transfer is still settling. Try again in a moment.");
}

export async function sendFunds(
  user: UserDocument,
  input: SendFundsInput,
  gateway: MovementGateway = liveGateway,
): Promise<OkDTO> {
  await connectDb();
  const accountId = requireAccount(user);
  if (!Types.ObjectId.isValid(input.recipientId) || input.recipientId === user._id.toString()) {
    if (input.recipientId === user._id.toString()) throw new InvalidState("You can't send money to yourself.");
    throw new NotFound("Recipient not found.");
  }
  const recipient = await User.findById(input.recipientId);
  if (!recipient || recipient.kind === "REVENUE" || recipient.airwallex.provisioning.step !== "READY" || !recipient.airwallex.accountId) {
    throw new NotFound("Recipient not found.");
  }

  const currency = getServerConfig().currency;
  const amountMinor = parseAmount(input.amount, currency);
  if ((await availableMinor(gateway, accountId, currency)) < amountMinor) {
    throw new InsufficientBalance("Wallet balance is too low.");
  }

  const nonce = movementNonce(user._id.toString(), input.idempotencyKey);
  const reference = `Send to ${recipient.name}`.slice(0, 140);
  const created = await gateway.createCharge({
    amountMinor,
    currency,
    source: accountId,
    requestId: sendChargeRequestId(nonce),
    reason: SEND_REASON,
    reference,
  });
  if (!readString(created, "id") && readString(created, "status") === "PENDING") {
    throw new InvalidState("That send is already in progress.");
  }
  await settledCharge(created, gateway);

  try {
    await gateway.createConnectedAccountTransfer({
      amountMinor,
      currency,
      destination: recipient.airwallex.accountId,
      requestId: sendTransferRequestId(nonce),
      reason: SEND_REASON,
      reference,
    });
  } catch {
    try {
      await gateway.createConnectedAccountTransfer({
        amountMinor,
        currency,
        destination: accountId,
        requestId: sendReturnRequestId(nonce),
        reason: SEND_REASON,
        reference: "Returned send",
      });
    } catch {
      throw new InvalidState("The send didn't complete. The amount may still be on the platform account.");
    }
    throw new InvalidState("The send didn't complete, and the amount was returned to your wallet.");
  }

  return OkSchema.parse({ ok: true });
}
