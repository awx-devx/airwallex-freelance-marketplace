import { Types } from "mongoose";
import type { CardPaymentSessionDTO } from "@/contracts/payments";
import { CardPaymentSessionSchema } from "@/contracts/payments";
import { offerActions } from "@/contracts/permissions";
import { readString, type JsonObject } from "@/lib/airwallex/json";
import { cancelPaymentIntent, createPaymentIntent, retrievePaymentIntent, type CreatePaymentIntentInput } from "@/lib/airwallex/payments";
import { createRefund, type CreateRefundInput } from "@/lib/airwallex/refunds";
import { cancelledCheckoutRefundRequestId, chargeRequestId, paymentIntentCancelRequestId, paymentIntentRequestId } from "@/lib/airwallex/requestIds";
import { createCharge, currentBalances, retrieveCharge } from "@/lib/airwallex/wallet";
import { getServerConfig } from "@/lib/config";
import { connectDb } from "@/lib/db";
import { Offer, type OfferDocument } from "@/models/offer";
import { Payment, type PaymentDocument } from "@/models/payment";
import { PlatformSettings } from "@/models/platformSettings";
import { User, type UserDocument } from "@/models/user";
import { Activity } from "@/models/activity";
import { Forbidden, InsufficientBalance, InvalidState, NotFound } from "@/server/errors";
import { markCardPaymentFailed, onFundingSucceeded, refreshRefunds, refreshSplits, refreshTransfers, type SplitGateway, type TransferGateway } from "@/services/release";
import { getOffer } from "@/services/offers";
import { mapBalances } from "@/services/wallet";

const PAYABLE = new Set(["REQUIRES_PAYMENT_METHOD", "REQUIRES_CUSTOMER_ACTION", "REQUIRES_CAPTURE", "PENDING"]);

export type CardGateway = {
  createPaymentIntent: (input: CreatePaymentIntentInput) => Promise<JsonObject>;
  retrievePaymentIntent: (paymentIntentId: string) => Promise<JsonObject>;
  cancelPaymentIntent: (paymentIntentId: string, requestId: string, relatedOfferId?: string) => Promise<JsonObject>;
};

const liveCards: CardGateway = {
  createPaymentIntent,
  retrievePaymentIntent,
  cancelPaymentIntent: (paymentIntentId, requestId, relatedOfferId) =>
    cancelPaymentIntent({ paymentIntentId, requestId, relatedOfferId }),
};

export type CardRefundGateway = {
  createRefund: (input: CreateRefundInput) => Promise<JsonObject>;
};

const liveCardRefunds: CardRefundGateway = { createRefund };

export type WalletGateway = {
  currentBalances: typeof currentBalances;
  createCharge: typeof createCharge;
  retrieveCharge: typeof retrieveCharge;
};

const liveWallet: WalletGateway = { currentBalances, createCharge, retrieveCharge };

async function loadOffer(offerId: string, userId: string): Promise<OfferDocument> {
  await connectDb();
  if (!Types.ObjectId.isValid(offerId)) throw new NotFound("Offer not found.");
  const offer = await Offer.findById(offerId);
  if (!offer) throw new NotFound("Offer not found.");
  if (offer.buyerId.toString() !== userId && offer.sellerId.toString() !== userId) {
    throw new Forbidden("You're not part of this offer.");
  }
  return offer;
}

function isBuyer(offer: OfferDocument, userId: string): boolean {
  return offer.buyerId.toString() === userId;
}

async function assertDestinations(offer: OfferDocument): Promise<void> {
  const [seller, settings] = await Promise.all([User.findById(offer.sellerId), PlatformSettings.findById("default")]);
  if (!seller?.airwallex.accountId) throw new InvalidState("The seller's Airwallex account isn't ready.");
  if (!settings?.revenueAccountId) throw new InvalidState("Run npm run seed so the fee account exists.");
}

function session(offer: OfferDocument, payment: PaymentDocument): CardPaymentSessionDTO {
  if (!payment.paymentIntentId || !payment.clientSecret) {
    throw new Error("Card payment is missing its PaymentIntent.");
  }
  return CardPaymentSessionSchema.parse({
    offerId: offer._id.toString(),
    intentId: payment.paymentIntentId,
    clientSecret: payment.clientSecret,
    amount: { amountMinor: offer.totalMinor, currency: offer.currency },
  });
}

async function claimAwaiting(offer: OfferDocument, paymentId: Types.ObjectId): Promise<OfferDocument> {
  const updated = await Offer.findOneAndUpdate(
    { _id: offer._id, buyerId: offer.buyerId, status: { $in: ["SENT", "AWAITING_PAYMENT"] } },
    { $set: { status: "AWAITING_PAYMENT", fundingRail: "CARD", paymentId } },
    { returnDocument: "after" },
  );
  if (!updated) throw new InvalidState("That action isn't available.");
  return updated;
}

async function nextAttempt(offerId: Types.ObjectId): Promise<number> {
  const latest = await Payment.findOne({ offerId }).sort({ attempt: -1 });
  return (latest?.attempt ?? 0) + 1;
}

export async function startCardPayment(
  user: UserDocument,
  offerId: string,
  gateway: CardGateway = liveCards,
  splits?: SplitGateway,
): Promise<CardPaymentSessionDTO> {
  const offer = await loadOffer(offerId, user._id.toString());
  if (!isBuyer(offer, user._id.toString()) || !offerActions(offer, "BUYER").some((action) => action === "ACCEPT_AND_PAY" || action === "CONTINUE_PAYMENT")) {
    throw new InvalidState("That action isn't available.");
  }
  await assertDestinations(offer);

  const pending = await Payment.findOne({ offerId: offer._id, rail: "CARD", status: "PENDING" }).sort({ attempt: -1 });
  if (pending?.paymentIntentId && pending.clientSecret) {
    const retrieved = await gateway.retrievePaymentIntent(pending.paymentIntentId);
    const status = readString(retrieved, "status") ?? "";
    if (status === "SUCCEEDED") {
      await onFundingSucceeded(offer._id.toString(), splits);
      return session(offer, pending);
    }
    if (PAYABLE.has(status) || status === "") {
      const waiting = await claimAwaiting(offer, pending._id);
      return session(waiting, pending);
    }
    await markCardPaymentFailed(pending.paymentIntentId, status === "CANCELLED" ? "CANCELLED" : "FAILED");
  }

  const config = getServerConfig();
  const attempt = await nextAttempt(offer._id);
  const created = await gateway.createPaymentIntent({
    amountMinor: offer.totalMinor,
    currency: offer.currency,
    merchantOrderId: offer._id.toString(),
    requestId: paymentIntentRequestId(offer._id.toString(), attempt),
    metadata: { offerId: offer._id.toString(), offerRef: offer.shortRef },
    returnUrl: `${config.appUrl}/offers/${offer._id.toString()}/pay/return`,
    relatedOfferId: offer._id.toString(),
  });
  const intentId = readString(created, "id");
  const clientSecret = readString(created, "client_secret");
  if (!intentId || !clientSecret) throw new Error("Airwallex did not return a PaymentIntent.");

  const payment = await Payment.create({
    offerId: offer._id,
    attempt,
    rail: "CARD",
    amountMinor: offer.totalMinor,
    currency: offer.currency,
    paymentIntentId: intentId,
    clientSecret,
    status: "PENDING",
    refundedMinor: 0,
  });
  const waiting = await claimAwaiting(offer, payment._id);
  return session(waiting, payment);
}

export async function reconcileCardPayment(
  user: UserDocument,
  offerId: string,
  gateway: CardGateway = liveCards,
  splits?: SplitGateway,
  refunds: CardRefundGateway = liveCardRefunds,
) {
  const offer = await loadOffer(offerId, user._id.toString());
  if (!isBuyer(offer, user._id.toString())) throw new Forbidden("You're not part of this offer.");
  await applyCardStatus(offer, gateway, splits, refunds);
  return getOffer(user, offerId);
}

export async function cancelCardPayment(
  user: UserDocument,
  offerId: string,
  gateway: CardGateway = liveCards,
  splits?: SplitGateway,
) {
  const offer = await loadOffer(offerId, user._id.toString());
  if (!isBuyer(offer, user._id.toString()) || !offerActions(offer, "BUYER").includes("CANCEL_PAYMENT")) {
    throw new InvalidState("That action isn't available.");
  }
  const pending = await Payment.findOne({ offerId: offer._id, rail: "CARD", status: "PENDING" }).sort({ attempt: -1 });
  if (pending?.paymentIntentId) {
    const outcome = await releaseOrCancelIntent(offer._id.toString(), pending, gateway, splits);
    if (outcome === "funded") return getOffer(user, offerId);
    await Payment.updateOne({ _id: pending._id, status: "PENDING" }, { $set: { status: "CANCELLED" } });
  }
  const updated = await Offer.findOneAndUpdate(
    { _id: offer._id, status: "AWAITING_PAYMENT" },
    { $set: { status: "SENT" }, $unset: { fundingRail: "" } },
    { returnDocument: "after" },
  );
  if (!updated) throw new InvalidState("That action isn't available.");
  await Activity.create({
    offerId: offer._id,
    actorId: user._id,
    type: "PAYMENT_CANCELLED",
    message: `${user.name} cancelled the payment`,
  });
  return getOffer(user, offerId);
}

export async function syncOffer(
  user: UserDocument,
  offerId: string,
  gateway: CardGateway = liveCards,
  splits?: SplitGateway,
  wallet: WalletGateway = liveWallet,
  transfers?: TransferGateway,
  refunds: CardRefundGateway = liveCardRefunds,
) {
  const offer = await loadOffer(offerId, user._id.toString());
  await applyCardStatus(offer, gateway, splits, refunds);
  await refreshSplits(offer._id.toString(), splits);
  await refreshRefunds(offer._id.toString());
  await refreshWalletFunding(offer._id.toString(), wallet);
  await refreshTransfers(offer._id.toString(), transfers);
  return getOffer(user, offerId);
}

async function applyCardStatus(
  offer: OfferDocument,
  gateway: CardGateway,
  splits?: SplitGateway,
  refunds: CardRefundGateway = liveCardRefunds,
): Promise<void> {
  const payment = await Payment.findOne({ offerId: offer._id, rail: "CARD" }).sort({ attempt: -1 });
  if (!payment?.paymentIntentId) return;
  if (payment.status === "SUCCEEDED") {
    await onFundingSucceeded(offer._id.toString(), splits);
    return;
  }
  if (payment.status === "CANCELLED" && payment.refundedMinor >= payment.amountMinor) return;
  const retrieved = await gateway.retrievePaymentIntent(payment.paymentIntentId);
  const status = readString(retrieved, "status") ?? "";
  if (status === "SUCCEEDED") {
    await onConfirmedCardIntent(payment.paymentIntentId, splits, refunds);
    return;
  }
  if (payment.status === "CANCELLED") return;
  if (status === "FAILED" || status === "CANCELLED") {
    await markCardPaymentFailed(payment.paymentIntentId, status);
  }
}

/**
 * A PaymentIntent Airwallex reports as SUCCEEDED. Fund the offer while checkout is still open.
 * Refund the full amount when the buyer already cancelled, so a late capture does not sit unallocated.
 */
export async function onConfirmedCardIntent(
  paymentIntentId: string,
  splits?: SplitGateway,
  refunds: CardRefundGateway = liveCardRefunds,
): Promise<string | undefined> {
  await connectDb();
  const payment = await Payment.findOne({ paymentIntentId });
  if (!payment) return undefined;
  const offer = await Offer.findById(payment.offerId);
  const offerId = payment.offerId.toString();
  if (!offer || offer.status === "COMPLETED" || offer.status === "CANCELLED") return offerId;
  const abandoned =
    payment.status === "CANCELLED" || offer.status === "SENT" || offer.status === "DECLINED" || offer.status === "WITHDRAWN";
  if (abandoned) {
    await refundCancelledCardCapture(payment, refunds);
    return offerId;
  }
  await onFundingSucceeded(offerId, splits);
  return offerId;
}

async function releaseOrCancelIntent(
  offerId: string,
  pending: PaymentDocument,
  gateway: CardGateway,
  splits?: SplitGateway,
): Promise<"funded" | "cancelled"> {
  if (!pending.paymentIntentId) return "cancelled";
  const retrieved = await gateway.retrievePaymentIntent(pending.paymentIntentId);
  const status = readString(retrieved, "status") ?? "";
  if (status === "SUCCEEDED") {
    await onFundingSucceeded(offerId, splits);
    return "funded";
  }
  if (status !== "" && !PAYABLE.has(status)) return "cancelled";
  try {
    await gateway.cancelPaymentIntent(
      pending.paymentIntentId,
      paymentIntentCancelRequestId(pending._id.toString()),
      offerId,
    );
  } catch (error) {
    const again = await gateway.retrievePaymentIntent(pending.paymentIntentId);
    if (readString(again, "status") === "SUCCEEDED") {
      await onFundingSucceeded(offerId, splits);
      return "funded";
    }
    throw error;
  }
  return "cancelled";
}

async function refundCancelledCardCapture(payment: PaymentDocument, refunds: CardRefundGateway): Promise<void> {
  if (!payment.paymentIntentId || payment.refundedMinor >= payment.amountMinor) return;
  const created = await refunds.createRefund({
    paymentIntentId: payment.paymentIntentId,
    amountMinor: payment.amountMinor,
    currency: payment.currency,
    requestId: cancelledCheckoutRefundRequestId(payment._id.toString()),
    reason: "Checkout cancelled",
    metadata: { offerId: payment.offerId.toString() },
  });
  if (!readString(created, "id")) throw new Error("Refund did not return an id.");
  await Payment.updateOne(
    { _id: payment._id, refundedMinor: { $lt: payment.amountMinor } },
    { $set: { status: "CANCELLED", refundedMinor: payment.amountMinor } },
  );
  await Activity.create({
    offerId: payment.offerId,
    type: "PAYMENT_REFUNDED",
    message: "Card payment was refunded because checkout was cancelled",
  });
}

async function pendingCardIntent(offer: OfferDocument, cards: CardGateway, splits?: SplitGateway): Promise<"none" | "funded" | "payable"> {
  const pendingCard = await Payment.findOne({ offerId: offer._id, rail: "CARD", status: "PENDING" }).sort({ attempt: -1 });
  if (!pendingCard?.paymentIntentId) return "none";
  const retrieved = await cards.retrievePaymentIntent(pendingCard.paymentIntentId);
  const status = readString(retrieved, "status") ?? "";
  if (status === "SUCCEEDED") {
    await onFundingSucceeded(offer._id.toString(), splits);
    return "funded";
  }
  if (status === "FAILED" || status === "CANCELLED") {
    await markCardPaymentFailed(pendingCard.paymentIntentId, status);
    return "none";
  }
  if (PAYABLE.has(status) || status === "") return "payable";
  await markCardPaymentFailed(pendingCard.paymentIntentId, "FAILED");
  return "none";
}

async function cancelPayableCard(offer: OfferDocument, cards: CardGateway): Promise<void> {
  const pendingCard = await Payment.findOne({ offerId: offer._id, rail: "CARD", status: "PENDING" }).sort({ attempt: -1 });
  if (!pendingCard?.paymentIntentId) return;
  await cards.cancelPaymentIntent(
    pendingCard.paymentIntentId,
    paymentIntentCancelRequestId(pendingCard._id.toString()),
    offer._id.toString(),
  );
  await Payment.updateOne({ _id: pendingCard._id, status: "PENDING" }, { $set: { status: "CANCELLED" } });
}

export async function payFromWallet(
  user: UserDocument,
  offerId: string,
  gateway: WalletGateway = liveWallet,
  cards: CardGateway = liveCards,
  splits?: SplitGateway,
) {
  if (!getServerConfig().walletRailEnabled) throw new InvalidState("Wallet payments aren't available.");
  const offer = await loadOffer(offerId, user._id.toString());
  if (!isBuyer(offer, user._id.toString()) || !offerActions(offer, "BUYER").some((action) => action === "ACCEPT_AND_PAY" || action === "CONTINUE_PAYMENT")) {
    throw new InvalidState("That action isn't available.");
  }
  const cardState = await pendingCardIntent(offer, cards, splits);
  if (cardState === "funded") return getOffer(user, offerId);
  const accountId = user.airwallex.accountId;
  if (!accountId) throw new InvalidState("Your Airwallex account isn't ready.");

  const existing = await Payment.findOne({ offerId: offer._id, rail: "WALLET", chargeId: { $exists: true, $ne: null } }).sort({ attempt: -1 });
  if (existing?.chargeId) {
    if (existing.status === "FAILED") throw new InvalidState("The wallet payment failed.");
    if (existing.status === "SUCCEEDED") {
      await onFundingSucceeded(offer._id.toString());
      return getOffer(user, offerId);
    }
    const retrieved = await gateway.retrieveCharge(existing.chargeId);
    const status = readString(retrieved, "status") ?? "";
    if (status === "SETTLED") {
      await onFundingSucceeded(offer._id.toString());
      return getOffer(user, offerId);
    }
    if (status === "FAILED" || status === "SUSPENDED") {
      await markWalletChargeFailed(existing.chargeId);
      throw new InvalidState("The wallet payment failed.");
    }
    return getOffer(user, offerId);
  }

  const balances = mapBalances(await gateway.currentBalances(accountId), offer.currency);
  const available = balances[0]?.available.amountMinor ?? 0;
  if (available < offer.totalMinor) throw new InsufficientBalance("Wallet balance is too low.");
  if (cardState === "payable") await cancelPayableCard(offer, cards);

  // AIRWALLEX: charge reason is an enum, not free text. The human label goes in reference.
  // https://www.airwallex.com/docs/api/scale/charges/create
  const created = await gateway.createCharge({
    amountMinor: offer.totalMinor,
    currency: offer.currency,
    source: accountId,
    requestId: chargeRequestId(offer._id.toString()),
    reason: "professional_business_services",
    reference: `Marketplace funding ${offer.shortRef}`,
    relatedOfferId: offer._id.toString(),
  });
  const chargeId = readString(created, "id");
  if (!chargeId) throw new Error("Airwallex did not return a charge.");
  const status = readString(created, "status") ?? "PENDING";
  const failed = status === "FAILED" || status === "SUSPENDED";
  const payment = await Payment.create({
    offerId: offer._id,
    attempt: await nextAttempt(offer._id),
    rail: "WALLET",
    amountMinor: offer.totalMinor,
    currency: offer.currency,
    chargeId,
    status: status === "SETTLED" ? "SUCCEEDED" : failed ? "FAILED" : "PENDING",
    refundedMinor: 0,
    ...(failed ? { failureReason: "Wallet payment failed." } : {}),
  });
  await Offer.findOneAndUpdate(
    { _id: offer._id, buyerId: offer.buyerId, status: { $in: ["SENT", "AWAITING_PAYMENT"] } },
    { $set: { status: "AWAITING_PAYMENT", fundingRail: "WALLET", paymentId: payment._id } },
  );
  if (status === "SETTLED") await onFundingSucceeded(offer._id.toString());
  if (failed) {
    await markWalletChargeFailed(chargeId);
    throw new InvalidState("The wallet payment failed.");
  }
  return getOffer(user, offerId);
}

export async function markWalletChargeFailed(chargeId: string): Promise<string | undefined> {
  await connectDb();
  const payment = await Payment.findOneAndUpdate(
    { chargeId, status: "PENDING" },
    { $set: { status: "FAILED", failureReason: "Wallet payment failed." } },
    { returnDocument: "after" },
  );
  const offerId = payment?.offerId ?? (await Payment.findOne({ chargeId }))?.offerId;
  if (!offerId) return undefined;
  const offer = await Offer.findOneAndUpdate(
    { _id: offerId, status: "AWAITING_PAYMENT" },
    { $set: { status: "SENT" }, $unset: { fundingRail: "" } },
  );
  if (offer) {
    await Activity.create({
      offerId,
      actorId: offer.buyerId,
      type: "PAYMENT_FAILED",
      message: "Wallet payment failed.",
    });
  }
  return offerId.toString();
}

async function refreshWalletFunding(offerId: string, gateway: WalletGateway): Promise<void> {
  const payment = await Payment.findOne({ offerId, rail: "WALLET" }).sort({ attempt: -1 });
  if (!payment?.chargeId || payment.status === "CANCELLED" || payment.status === "FAILED") return;
  if (payment.status === "SUCCEEDED") {
    await onFundingSucceeded(offerId);
    return;
  }
  const retrieved = await gateway.retrieveCharge(payment.chargeId);
  const status = readString(retrieved, "status") ?? "";
  if (status === "SETTLED") await onFundingSucceeded(offerId);
  else if (status === "FAILED" || status === "SUSPENDED") await markWalletChargeFailed(payment.chargeId);
}
