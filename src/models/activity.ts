import { Schema, model, models, type Model, type Types } from "mongoose";

const ActivitySchema = new Schema(
  {
    offerId: { type: Schema.Types.ObjectId, ref: "Offer", required: true },
    actorId: { type: Schema.Types.ObjectId, ref: "User" },
    type: { type: String, required: true },
    message: { type: String, required: true },
    meta: Schema.Types.Mixed,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

ActivitySchema.index({ offerId: 1, createdAt: -1 });

export type ActivityDocument = {
  _id: Types.ObjectId;
  offerId: Types.ObjectId;
  actorId?: Types.ObjectId;
  type: string;
  message: string;
  meta?: unknown;
  createdAt: Date;
};

export const Activity: Model<ActivityDocument> =
  (models.Activity as Model<ActivityDocument> | undefined) ?? model<ActivityDocument>("Activity", ActivitySchema, "activity");
