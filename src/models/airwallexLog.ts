import { Schema, model, models, type Model, type Types } from "mongoose";

const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60;

const AirwallexLogSchema = new Schema(
  {
    method: { type: String, required: true },
    path: { type: String, required: true },
    onBehalfOf: String,
    requestId: String,
    requestBody: Schema.Types.Mixed,
    status: { type: Number, required: true },
    responseBody: Schema.Types.Mixed,
    errorCode: String,
    durationMs: { type: Number, required: true },
    relatedOfferId: { type: Schema.Types.ObjectId, ref: "Offer" },
    relatedMilestoneId: Schema.Types.ObjectId,
    relatedUserId: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

AirwallexLogSchema.index({ relatedOfferId: 1, createdAt: -1 });
AirwallexLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: THIRTY_DAYS_SECONDS });

export type AirwallexLogDocument = {
  _id: Types.ObjectId;
  method: string;
  path: string;
  onBehalfOf?: string;
  requestId?: string;
  requestBody?: unknown;
  status: number;
  responseBody?: unknown;
  errorCode?: string;
  durationMs: number;
  relatedOfferId?: Types.ObjectId;
  relatedMilestoneId?: Types.ObjectId;
  relatedUserId?: Types.ObjectId;
  createdAt: Date;
};

export const AirwallexLog: Model<AirwallexLogDocument> =
  (models.AirwallexLog as Model<AirwallexLogDocument> | undefined) ??
  model<AirwallexLogDocument>("AirwallexLog", AirwallexLogSchema, "airwallex_logs");
