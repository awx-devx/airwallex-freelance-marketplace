import { Schema, model, models, type Model, type Types } from "mongoose";

const PlatformSettingsSchema = new Schema(
  {
    _id: { type: String, default: "default" },
    revenueUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    revenueAccountId: { type: String, required: true },
    seedVersion: { type: Number, required: true },
    lastSeededAt: { type: Date, required: true },
  },
  { timestamps: false },
);

export type PlatformSettingsDocument = {
  _id: string;
  revenueUserId: Types.ObjectId;
  revenueAccountId: string;
  seedVersion: number;
  lastSeededAt: Date;
};

export const PlatformSettings: Model<PlatformSettingsDocument> =
  (models.PlatformSettings as Model<PlatformSettingsDocument> | undefined) ??
  model<PlatformSettingsDocument>("PlatformSettings", PlatformSettingsSchema, "platform_settings");
