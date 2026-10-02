import { readString } from "@/lib/airwallex/json";
import { extractAccountId, extractObject } from "@/lib/airwallex/webhooks";
import { connectDb } from "@/lib/db";
import { Payment } from "@/models/payment";
import { User } from "@/models/user";
import { advanceRefundStatus, advanceSplitStatus, advanceTransferStatus, markCardPaymentFailed, onFundingSucceeded, type SplitGateway } from "@/services/release";
import { markWalletChargeFailed } from "@/services/funding";

const ACCOUNT_STATUS = {
  "account.active": "ACTIVE",
  "account.action_required": "ACTION_REQUIRED",
  "account.suspended": "SUSPENDED",
} as const;

function metadata(object: unknown): Record<string, unknown> | undefined {
  if (!object || typeof object !== "object" || !("metadata" in object)) return undefined;
  const value = (object as { metadata?: unknown }).metadata;
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function metaString(object: unknown, key: string): string | undefined {
  const value = metadata(object)?.[key];
  return typeof value === "string" ? value : undefined;
}

function refundStatusFromName(name: string): string | undefined {
  if (name === "refund.received") return "RECEIVED";
  if (name === "refund.accepted") return "ACCEPTED";
  if (name === "refund.settled") return "SETTLED";
  if (name === "refund.failed") return "FAILED";
  return undefined;
}

function splitStatusFromName(name: string): string | undefined {
  if (name === "funds_split.created") return "CREATED";
  if (name === "funds_split.released") return "RELEASED";
  if (name === "funds_split.settled") return "SETTLED";
  if (name === "funds_split.failed") return "FAILED";
  return undefined;
}

function transferStatusFromName(name: string): string | undefined {
  if (name.endsWith(".settled")) return "SETTLED";
  if (name.endsWith(".failed")) return "FAILED";
  if (name.endsWith(".suspended")) return "SUSPENDED";
  return undefined;
}

/** Apply one stored Airwallex event. Returns the offer id when the event belongs to one. */
export async function dispatchWebhook(event: unknown, splits?: SplitGateway): Promise<string | undefined> {
  await connectDb();
  if (!event || typeof event !== "object") return undefined;
  const name = readString(event, "name") ?? "";
  const object = extractObject(event);
  const objectId = readString(object, "id");
  const offerId = metaString(object, "offerId");

  if (name === "payment_intent.succeeded") {
    const id = offerId ?? (await paymentOfferId(objectId));
    if (id) await onFundingSucceeded(id, splits);
    return id;
  }

  if (name === "payment_intent.payment_failed" || name === "payment_intent.cancelled") {
    if (!objectId) return offerId;
    return (await markCardPaymentFailed(objectId, name.endsWith("cancelled") ? "CANCELLED" : "FAILED")) ?? offerId;
  }

  if (name.startsWith("refund.")) {
    const status = readString(object, "status") ?? refundStatusFromName(name);
    const milestoneId = metaString(object, "milestoneId");
    if (objectId && status) {
      return (await advanceRefundStatus(objectId, status, milestoneId)) ?? offerId;
    }
    return offerId;
  }

  if (name.startsWith("funds_split.")) {
    const status = readString(object, "status") ?? splitStatusFromName(name);
    if (objectId && status) {
      const related = await advanceSplitStatus(objectId, status);
      return related ?? offerId;
    }
    return offerId;
  }

  if (name === "charge.settled" || name === "charge.failed" || name === "charge.suspended") {
    if (!objectId) return offerId;
    if (name === "charge.settled") {
      const payment = await Payment.findOne({ chargeId: objectId });
      if (payment) await onFundingSucceeded(payment.offerId.toString(), splits);
      return payment?.offerId.toString() ?? offerId;
    }
    return (await markWalletChargeFailed(objectId)) ?? offerId;
  }

  if (name.startsWith("connected_account_transfer.")) {
    const requestId = readString(object, "request_id") ?? "";
    if (requestId.startsWith("welcome:") || requestId.startsWith("seedtopup:")) return undefined;
    const status = readString(object, "status") ?? transferStatusFromName(name);
    if (objectId && status) return (await advanceTransferStatus(objectId, status)) ?? offerId;
    return offerId;
  }

  const accountStatus = ACCOUNT_STATUS[name as keyof typeof ACCOUNT_STATUS];
  if (accountStatus) {
    const accountId = extractAccountId(event) ?? objectId;
    if (accountId) {
      await User.updateOne({ "airwallex.accountId": accountId }, { $set: { "airwallex.accountStatus": accountStatus } });
    }
  }

  return offerId;
}

async function paymentOfferId(paymentIntentId: string | undefined): Promise<string | undefined> {
  if (!paymentIntentId) return undefined;
  const payment = await Payment.findOne({ paymentIntentId });
  return payment?.offerId.toString();
}
