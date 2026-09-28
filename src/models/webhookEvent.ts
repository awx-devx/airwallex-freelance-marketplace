import { Schema, model, models, type Model, type Types } from "mongoose";

const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60;

const WebhookEventSchema = new Schema(
  {
    eventId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    accountId: String,
    objectId: String,
    payload: { type: Schema.Types.Mixed, required: true },
    signatureValid: { type: Boolean, required: true },
    processedAt: Date,
    processingError: String,
    relatedOfferId: { type: Schema.Types.ObjectId, ref: "Offer" },
    receivedAt: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: false },
);

WebhookEventSchema.index({ relatedOfferId: 1, receivedAt: -1 });
WebhookEventSchema.index({ receivedAt: 1 }, { expireAfterSeconds: THIRTY_DAYS_SECONDS });

export type WebhookEventDocument = {
  _id: Types.ObjectId;
  eventId: string;
  name: string;
  accountId?: string;
  objectId?: string;
  payload: unknown;
  signatureValid: boolean;
  processedAt?: Date;
  processingError?: string;
  relatedOfferId?: Types.ObjectId;
  receivedAt: Date;
};

export const WebhookEvent: Model<WebhookEventDocument> =
  (models.WebhookEvent as Model<WebhookEventDocument> | undefined) ??
  model<WebhookEventDocument>("WebhookEvent", WebhookEventSchema, "webhook_events");
