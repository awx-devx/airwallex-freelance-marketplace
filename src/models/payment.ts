import { Schema, model, models, type Model, type Types } from "mongoose";

const PaymentSchema = new Schema(
  {
    offerId: { type: Schema.Types.ObjectId, ref: "Offer", required: true },
    attempt: { type: Number, required: true },
    rail: { type: String, enum: ["CARD", "WALLET"], required: true },
    amountMinor: { type: Number, required: true },
    currency: { type: String, required: true },
    paymentIntentId: String,
    // DEMO-ONLY: Stored so checkout can be re-rendered after a refresh.
    // PROD: Don't persist client_secret; re-fetch the PaymentIntent or create a new one.
    clientSecret: String,
    chargeId: String,
    status: { type: String, enum: ["PENDING", "SUCCEEDED", "FAILED", "CANCELLED"], required: true },
    failureReason: String,
    refundedMinor: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

PaymentSchema.index({ paymentIntentId: 1 }, { unique: true, sparse: true });
PaymentSchema.index({ chargeId: 1 }, { unique: true, sparse: true });
PaymentSchema.index({ offerId: 1, attempt: 1 }, { unique: true });

export type PaymentDocument = {
  _id: Types.ObjectId;
  offerId: Types.ObjectId;
  attempt: number;
  rail: "CARD" | "WALLET";
  amountMinor: number;
  currency: string;
  paymentIntentId?: string;
  clientSecret?: string;
  chargeId?: string;
  status: "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
  failureReason?: string;
  refundedMinor: number;
  createdAt: Date;
  updatedAt: Date;
};

export const Payment: Model<PaymentDocument> =
  (models.Payment as Model<PaymentDocument> | undefined) ?? model<PaymentDocument>("Payment", PaymentSchema);
