import { Schema, model, models, type Model } from "mongoose";
import { AccountStatusSchema, DemoAccountSchema, ProvisioningStepSchema } from "@/contracts/users";

const ProvisioningSchema = new Schema(
  {
    step: { type: String, enum: ProvisioningStepSchema.options, required: true, default: "NONE" },
    /** The checklist step that stopped, set only while `step` is `FAILED`. */
    failedStep: { type: String, enum: ["ACCOUNT_CREATED", "SUBMITTED", "ACTIVE", "WELCOME_CREDITED", "READY"] },
    lastError: String,
    updatedAt: { type: Date, required: true, default: () => new Date() },
  },
  { _id: false },
);

const AirwallexSchema = new Schema(
  {
    accountId: String,
    accountStatus: { type: String, enum: AccountStatusSchema.options },
    provisioning: { type: ProvisioningSchema, required: true, default: () => ({ step: "NONE", updatedAt: new Date() }) },
  },
  { _id: false },
);

const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true },
    headline: String,
    avatarColor: { type: String, required: true },
    kind: { type: String, enum: ["REGULAR", "SEED", "REVENUE"], required: true, default: "REGULAR" },
    isGuestPool: { type: Boolean, required: true, default: false },
    /** SEED personas only. Drives the login page "Log in as" list. */
    demoRole: { type: String, enum: DemoAccountSchema.shape.role.options },
    airwallex: { type: AirwallexSchema, required: true, default: () => ({ provisioning: { step: "NONE", updatedAt: new Date() } }) },
  },
  { timestamps: true },
);

UserSchema.index({ "airwallex.accountId": 1 }, { unique: true, sparse: true });
UserSchema.index({ isGuestPool: 1 });

export type UserDocument = {
  _id: import("mongoose").Types.ObjectId;
  email: string;
  passwordHash: string;
  name: string;
  headline?: string;
  avatarColor: string;
  kind: "REGULAR" | "SEED" | "REVENUE";
  isGuestPool: boolean;
  demoRole?: "Seller" | "Buyer" | "Both";
  airwallex: {
    accountId?: string;
    accountStatus?: "CREATED" | "SUBMITTED" | "ACTIVE" | "ACTION_REQUIRED" | "SUSPENDED";
    provisioning: {
      step: "NONE" | "ACCOUNT_CREATED" | "SUBMITTED" | "ACTIVE" | "WELCOME_CREDITED" | "READY" | "FAILED";
      failedStep?: "ACCOUNT_CREATED" | "SUBMITTED" | "ACTIVE" | "WELCOME_CREDITED" | "READY";
      lastError?: string;
      updatedAt: Date;
    };
  };
  createdAt: Date;
  updatedAt: Date;
};

export const User: Model<UserDocument> =
  (models.User as Model<UserDocument> | undefined) ?? model<UserDocument>("User", UserSchema);
