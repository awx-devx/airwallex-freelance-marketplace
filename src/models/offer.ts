import { Schema, model, models, type Model, type Types } from "mongoose";
import { MilestoneStatusSchema, OfferStatusSchema } from "@/contracts/offers";

const SplitRefSchema = new Schema(
  {
    splitId: { type: String, required: true },
    amountMinor: { type: Number, required: true },
    destination: { type: String, required: true },
    status: { type: String, enum: ["CREATED", "RELEASED", "SETTLED", "FAILED"], required: true },
    reversalId: String,
    reversalStatus: String,
  },
  { _id: false },
);

const RefundRefSchema = new Schema(
  {
    refundId: { type: String, required: true },
    status: { type: String, enum: ["RECEIVED", "ACCEPTED", "SETTLED", "FAILED"], required: true },
  },
  { _id: false },
);

const TransferRefSchema = new Schema(
  {
    transferId: { type: String, required: true },
    amountMinor: { type: Number, required: true },
    destination: { type: String, required: true },
    status: { type: String, enum: ["NEW", "PENDING", "SETTLED", "SUSPENDED", "FAILED"], required: true },
  },
  { _id: false },
);

const ReviewSchema = new Schema(
  {
    decision: { type: String, enum: ["APPROVED", "CHANGES_REQUESTED"], required: true },
    comment: String,
    reviewedAt: { type: Date, required: true },
  },
  { _id: false },
);

const DeliverySchema = new Schema(
  {
    links: { type: [String], required: true },
    note: String,
    submittedAt: { type: Date, required: true },
    review: ReviewSchema,
  },
  { timestamps: false },
);

const MilestoneSchema = new Schema(
  {
    index: { type: Number, required: true },
    title: { type: String, required: true },
    description: String,
    dueDate: Date,
    amountMinor: { type: Number, required: true },
    breakdown: {
      sellerMinor: { type: Number, required: true },
      revenueMinor: { type: Number, required: true },
      reserveMinor: { type: Number, required: true },
    },
    status: { type: String, enum: MilestoneStatusSchema.options, required: true },
    deliveries: { type: [DeliverySchema], default: [] },
    escrow: {
      sellerSplit: SplitRefSchema,
      revenueSplit: SplitRefSchema,
      refund: RefundRefSchema,
      sellerTransfer: TransferRefSchema,
      revenueTransfer: TransferRefSchema,
      refundTransfer: TransferRefSchema,
    },
    approvedAt: Date,
    paidAt: Date,
    refundedAt: Date,
  },
  { timestamps: false },
);

const OfferSchema = new Schema(
  {
    shortRef: { type: String, required: true, unique: true },
    sellerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    buyerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    currency: { type: String, required: true },
    totalMinor: { type: Number, required: true },
    status: { type: String, enum: OfferStatusSchema.options, required: true },
    fundingRail: { type: String, enum: ["CARD", "WALLET"] },
    feeSnapshot: {
      platformFeePercent: { type: Number, required: true },
      processingReservePercent: { type: Number, required: true },
    },
    paymentId: { type: Schema.Types.ObjectId, ref: "Payment" },
    isWelcomeOffer: { type: Boolean, required: true, default: false },
    /** Sparse unique key so `npm run seed` can skip an offer it already created. */
    seedKey: String,
    milestones: { type: [MilestoneSchema], required: true },
    sentAt: Date,
    acceptedAt: Date,
    fundedAt: Date,
    completedAt: Date,
    closedAt: Date,
  },
  { timestamps: true },
);

OfferSchema.index({ buyerId: 1, status: 1, createdAt: -1 });
OfferSchema.index({ sellerId: 1, status: 1, createdAt: -1 });
OfferSchema.index({ "milestones.escrow.sellerSplit.splitId": 1 }, { sparse: true });
OfferSchema.index({ "milestones.escrow.revenueSplit.splitId": 1 }, { sparse: true });
OfferSchema.index({ seedKey: 1 }, { unique: true, sparse: true });

export type OfferDocument = {
  _id: Types.ObjectId;
  shortRef: string;
  sellerId: Types.ObjectId;
  buyerId: Types.ObjectId;
  title: string;
  description: string;
  currency: string;
  totalMinor: number;
  status: (typeof OfferStatusSchema.options)[number];
  fundingRail?: "CARD" | "WALLET";
  feeSnapshot: { platformFeePercent: number; processingReservePercent: number };
  paymentId?: Types.ObjectId;
  isWelcomeOffer: boolean;
  seedKey?: string;
  milestones: Array<{
    _id: Types.ObjectId;
    index: number;
    title: string;
    description?: string;
    dueDate?: Date;
    amountMinor: number;
    breakdown: { sellerMinor: number; revenueMinor: number; reserveMinor: number };
    status: (typeof MilestoneStatusSchema.options)[number];
    deliveries: Array<{
      _id: Types.ObjectId;
      links: string[];
      note?: string;
      submittedAt: Date;
      review?: { decision: "APPROVED" | "CHANGES_REQUESTED"; comment?: string; reviewedAt: Date };
    }>;
    escrow?: {
      sellerSplit?: { splitId: string; amountMinor: number; destination: string; status: string };
      revenueSplit?: { splitId: string; amountMinor: number; destination: string; status: string };
      refund?: { refundId: string; status: string };
      sellerTransfer?: { transferId: string; amountMinor: number; destination: string; status: string };
      revenueTransfer?: { transferId: string; amountMinor: number; destination: string; status: string };
      refundTransfer?: { transferId: string; amountMinor: number; destination: string; status: string };
    };
    approvedAt?: Date;
    paidAt?: Date;
    refundedAt?: Date;
  }>;
  sentAt?: Date;
  acceptedAt?: Date;
  fundedAt?: Date;
  completedAt?: Date;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export const Offer: Model<OfferDocument> =
  (models.Offer as Model<OfferDocument> | undefined) ?? model<OfferDocument>("Offer", OfferSchema);
