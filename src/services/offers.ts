import { randomBytes } from "node:crypto";
import { Types } from "mongoose";
import type { CreateOfferInput, OffersQuery, RequestChangesInput, SubmitDeliveryInput } from "@/contracts/offers";
import { milestoneActions, offerActions } from "@/contracts/permissions";
import { getServerConfig } from "@/lib/config";
import { connectDb } from "@/lib/db";
import { fromAwxAmount } from "@/lib/money";
import { Activity } from "@/models/activity";
import { Offer, type OfferDocument } from "@/models/offer";
import { User, type UserDocument } from "@/models/user";
import { WELCOME_TEMPLATES } from "../../scripts/seed-data/welcome-templates";
import { toActivity, toOffer, toSummary } from "@/server/dto/offers";
import { Forbidden, HttpError, InvalidState, NotFound, ProvisioningIncomplete } from "@/server/errors";
import { breakdown } from "@/services/fees";

const SHORT_REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function shortRef(): string {
  const bytes = randomBytes(4);
  let code = "";
  for (const byte of bytes) code += SHORT_REF_ALPHABET[byte % SHORT_REF_ALPHABET.length];
  return `OF-${code}`;
}

function duplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: unknown }).code === 11000;
}

async function parties(offer: OfferDocument): Promise<{ seller: UserDocument; buyer: UserDocument }> {
  const [seller, buyer] = await Promise.all([User.findById(offer.sellerId), User.findById(offer.buyerId)]);
  if (!seller || !buyer) throw new Error("Offer is missing a party.");
  return { seller, buyer };
}

async function present(offer: OfferDocument, viewerId: string) {
  const { seller, buyer } = await parties(offer);
  return toOffer(offer, viewerId, seller, buyer);
}

async function record(
  offerId: Types.ObjectId,
  actorId: Types.ObjectId,
  type: string,
  message: string,
  milestoneId?: string,
): Promise<void> {
  await Activity.create({
    offerId,
    actorId,
    type,
    message,
    meta: milestoneId ? { milestoneId } : undefined,
  });
}

async function insertSentOffer(input: {
  seller: UserDocument;
  buyerId: string;
  title: string;
  description: string;
  currency: string;
  fee: { platformFeePercent: number; processingReservePercent: number };
  milestones: Array<{ title: string; description?: string; amountMinor: number; dueDate?: Date }>;
  isWelcomeOffer: boolean;
  activityMessage: string;
}): Promise<OfferDocument> {
  const milestones = input.milestones.map((milestone, index) => {
    const parts = breakdown(milestone.amountMinor, input.fee);
    return {
      index,
      title: milestone.title,
      description: milestone.description,
      dueDate: milestone.dueDate,
      amountMinor: milestone.amountMinor,
      breakdown: { sellerMinor: parts.sellerMinor, revenueMinor: parts.revenueMinor, reserveMinor: parts.reserveMinor },
      status: "PENDING_FUNDING" as const,
      deliveries: [],
    };
  });
  const totalMinor = milestones.reduce((sum, milestone) => sum + milestone.amountMinor, 0);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const created = await Offer.create({
        shortRef: shortRef(),
        sellerId: input.seller._id,
        buyerId: input.buyerId,
        title: input.title,
        description: input.description,
        currency: input.currency,
        totalMinor,
        status: "SENT",
        feeSnapshot: input.fee,
        isWelcomeOffer: input.isWelcomeOffer,
        milestones,
        sentAt: new Date(),
      });
      await record(created._id, input.seller._id, "OFFER_SENT", input.activityMessage);
      return created;
    } catch (error) {
      if (!duplicateKey(error) || attempt === 4) throw error;
    }
  }
  throw new Error("Could not create the offer.");
}

/**
 * One SENT offer from a ready seed seller. No-op when this buyer already has one.
 * DEMO-ONLY: A random seed seller's offer appears so a new signup has something to accept.
 * PROD: No generated offers. Buyers only see offers a seller actually sent.
 */
export async function createWelcomeOffer(buyerId: string): Promise<void> {
  await connectDb();
  const existing = await Offer.findOne({ buyerId, isWelcomeOffer: true });
  if (existing) return;

  const sellers = await User.find({
    _id: { $ne: buyerId },
    kind: "SEED",
    demoRole: { $in: ["Seller", "Both"] },
    "airwallex.provisioning.step": "READY",
  });
  const seller = sellers[Math.floor(Math.random() * sellers.length)];
  if (!seller) {
    throw new Error("No demo seller is ready yet. Run npm run seed, then retry.");
  }

  const template = WELCOME_TEMPLATES[Math.floor(Math.random() * WELCOME_TEMPLATES.length)];
  if (!template) throw new Error("No welcome offer templates are configured.");

  const config = getServerConfig();
  await insertSentOffer({
    seller,
    buyerId,
    title: template.title,
    description: template.description,
    currency: config.currency,
    fee: {
      platformFeePercent: config.platformFeePercent,
      processingReservePercent: config.processingReservePercent,
    },
    milestones: template.milestones.map((milestone) => ({
      title: milestone.title,
      amountMinor: fromAwxAmount(milestone.amount, config.currency),
    })),
    isWelcomeOffer: true,
    activityMessage: `${seller.name} sent a welcome offer.`,
  });
}

function buyerError(message: string): HttpError {
  return new HttpError(422, "VALIDATION_FAILED", message, { buyerId: [message] });
}

export async function createAndSend(seller: UserDocument, input: CreateOfferInput) {
  await connectDb();
  if (seller.airwallex.provisioning.step !== "READY") throw new ProvisioningIncomplete();
  if (!Types.ObjectId.isValid(input.buyerId)) throw buyerError("Choose a buyer who can receive offers.");
  if (input.buyerId === seller._id.toString()) throw buyerError("You can't send an offer to yourself.");

  const buyer = await User.findById(input.buyerId);
  if (!buyer || buyer.kind === "REVENUE" || buyer.airwallex.provisioning.step !== "READY") {
    throw buyerError("Choose a buyer who can receive offers.");
  }

  const config = getServerConfig();
  const offer = await insertSentOffer({
    seller,
    buyerId: buyer._id.toString(),
    title: input.title,
    description: input.description,
    currency: config.currency,
    fee: {
      platformFeePercent: config.platformFeePercent,
      processingReservePercent: config.processingReservePercent,
    },
    milestones: input.milestones.map((milestone) => ({
      title: milestone.title,
      description: milestone.description,
      dueDate: milestone.dueDate ? new Date(`${milestone.dueDate}T00:00:00.000Z`) : undefined,
      amountMinor: fromAwxAmount(milestone.amount, config.currency),
    })),
    isWelcomeOffer: false,
    activityMessage: `${seller.name} sent the offer`,
  });
  return present(offer, seller._id.toString());
}

export async function listOffers(viewer: UserDocument, view: OffersQuery["view"]) {
  await connectDb();
  const viewerId = viewer._id.toString();
  const filter =
    view === "selling"
      ? { sellerId: viewer._id }
      : view === "incoming"
        ? { buyerId: viewer._id, status: { $in: ["SENT", "AWAITING_PAYMENT"] as const } }
        : { buyerId: viewer._id, status: { $in: ["ACTIVE", "COMPLETED", "CANCELLED"] as const } };
  const offers = await Offer.find(filter).sort({ updatedAt: -1 });
  const ids = [...new Set(offers.flatMap((offer) => [offer.sellerId.toString(), offer.buyerId.toString()]))];
  const users = await User.find({ _id: { $in: ids } });
  const byId = new Map(users.map((user) => [user._id.toString(), user]));
  return offers.map((offer) => {
    const seller = byId.get(offer.sellerId.toString());
    const buyer = byId.get(offer.buyerId.toString());
    if (!seller || !buyer) throw new Error("Offer is missing a party.");
    return toSummary(offer, viewerId, seller, buyer);
  });
}

async function loadForParty(offerId: string, viewerId: string): Promise<OfferDocument> {
  await connectDb();
  if (!Types.ObjectId.isValid(offerId)) throw new NotFound("Offer not found.");
  const offer = await Offer.findById(offerId);
  if (!offer) throw new NotFound("Offer not found.");
  if (offer.buyerId.toString() !== viewerId && offer.sellerId.toString() !== viewerId) {
    throw new Forbidden("You're not part of this offer.");
  }
  return offer;
}

export async function getOffer(viewer: UserDocument, offerId: string) {
  const offer = await loadForParty(offerId, viewer._id.toString());
  return present(offer, viewer._id.toString());
}

async function transitionOffer(offer: OfferDocument, viewer: UserDocument, action: "DECLINE" | "WITHDRAW", nextStatus: "DECLINED" | "WITHDRAWN", type: string, message: string) {
  const viewerId = viewer._id.toString();
  if (!offerActions(offer, offer.buyerId.toString() === viewerId ? "BUYER" : "SELLER").includes(action)) {
    throw new InvalidState("That action isn't available.");
  }
  const updated = await Offer.findOneAndUpdate(
    { _id: offer._id, status: "SENT", ...(action === "DECLINE" ? { buyerId: viewer._id } : { sellerId: viewer._id }) },
    { $set: { status: nextStatus } },
    { returnDocument: "after" },
  );
  if (!updated) throw new InvalidState("That action isn't available.");
  await record(updated._id, viewer._id, type, message);
  return present(updated, viewerId);
}

export async function declineOffer(viewer: UserDocument, offerId: string) {
  const offer = await loadForParty(offerId, viewer._id.toString());
  return transitionOffer(offer, viewer, "DECLINE", "DECLINED", "OFFER_DECLINED", `${viewer.name} declined the offer`);
}

export async function withdrawOffer(viewer: UserDocument, offerId: string) {
  const offer = await loadForParty(offerId, viewer._id.toString());
  return transitionOffer(offer, viewer, "WITHDRAW", "WITHDRAWN", "OFFER_WITHDRAWN", `${viewer.name} withdrew the offer`);
}

function milestoneOf(offer: OfferDocument, milestoneId: string) {
  if (!Types.ObjectId.isValid(milestoneId)) throw new NotFound("Milestone not found.");
  const milestone = offer.milestones.find((item) => item._id.toString() === milestoneId);
  if (!milestone) throw new NotFound("Milestone not found.");
  return milestone;
}

export async function submitDelivery(viewer: UserDocument, offerId: string, milestoneId: string, input: SubmitDeliveryInput) {
  const viewerId = viewer._id.toString();
  const offer = await loadForParty(offerId, viewerId);
  const milestone = milestoneOf(offer, milestoneId);
  const viewerRole = offer.buyerId.toString() === viewerId ? "BUYER" : "SELLER";
  if (!milestoneActions(milestone, offer, viewerRole).includes("SUBMIT_DELIVERY")) {
    throw new InvalidState("That action isn't available.");
  }
  const updated = await Offer.findOneAndUpdate(
    {
      _id: offer._id,
      sellerId: viewer._id,
      status: "ACTIVE",
      milestones: { $elemMatch: { _id: milestone._id, status: { $in: ["FUNDED", "CHANGES_REQUESTED"] } } },
    },
    {
      $set: { "milestones.$.status": "SUBMITTED" },
      $push: {
        "milestones.$.deliveries": {
          links: input.links,
          note: input.note,
          submittedAt: new Date(),
        },
      },
    },
    { returnDocument: "after" },
  );
  if (!updated) throw new InvalidState("That action isn't available.");
  await record(updated._id, viewer._id, "DELIVERY_SUBMITTED", `${viewer.name} submitted ${milestone.title}`, milestoneId);
  return present(updated, viewerId);
}

export async function requestChanges(viewer: UserDocument, offerId: string, milestoneId: string, input: RequestChangesInput) {
  const viewerId = viewer._id.toString();
  const offer = await loadForParty(offerId, viewerId);
  const milestone = milestoneOf(offer, milestoneId);
  const viewerRole = offer.buyerId.toString() === viewerId ? "BUYER" : "SELLER";
  if (!milestoneActions(milestone, offer, viewerRole).includes("REQUEST_CHANGES")) {
    throw new InvalidState("That action isn't available.");
  }
  const deliveryIndex = milestone.deliveries.length - 1;
  const review = { decision: "CHANGES_REQUESTED" as const, comment: input.comment, reviewedAt: new Date() };
  const updated = await Offer.findOneAndUpdate(
    {
      _id: offer._id,
      buyerId: viewer._id,
      status: "ACTIVE",
      milestones: { $elemMatch: { _id: milestone._id, status: "SUBMITTED" } },
    },
    {
      $set: {
        "milestones.$.status": "CHANGES_REQUESTED",
        ...(deliveryIndex >= 0 ? { [`milestones.$.deliveries.${deliveryIndex}.review`]: review } : {}),
      },
    },
    { returnDocument: "after" },
  );
  if (!updated) throw new InvalidState("That action isn't available.");
  await record(updated._id, viewer._id, "CHANGES_REQUESTED", `${viewer.name} requested changes on ${milestone.title}`, milestoneId);
  return present(updated, viewerId);
}

export async function listActivity(viewer: UserDocument, offerId: string) {
  const offer = await loadForParty(offerId, viewer._id.toString());
  const items = await Activity.find({ offerId: offer._id }).sort({ createdAt: 1 });
  const actorIds = [...new Set(items.flatMap((item) => (item.actorId ? [item.actorId.toString()] : [])))];
  const actors = await User.find({ _id: { $in: actorIds } });
  const byId = new Map(actors.map((user) => [user._id.toString(), user]));
  return items.map((item) => toActivity(item, item.actorId ? byId.get(item.actorId.toString()) : undefined));
}
