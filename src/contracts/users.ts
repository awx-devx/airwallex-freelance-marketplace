import { z } from "zod";

export const UserSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  headline: z.string().optional(),
  avatarColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  initials: z.string().min(1).max(4),
});
export type UserSummaryDTO = z.infer<typeof UserSummarySchema>;

export const ProvisioningStepSchema = z.enum([
  "NONE",
  "ACCOUNT_CREATED",
  "SUBMITTED",
  "ACTIVE",
  "WELCOME_CREDITED",
  "READY",
  "FAILED",
]);
export type ProvisioningStep = z.infer<typeof ProvisioningStepSchema>;

export const AccountStatusSchema = z.enum(["CREATED", "SUBMITTED", "ACTIVE", "ACTION_REQUIRED", "SUSPENDED"]);

export const MeSchema = UserSummarySchema.extend({
  email: z.string().email(),
  kind: z.enum(["REGULAR", "SEED"]),
  isGuest: z.boolean(),
  airwallex: z.object({
    accountId: z.string().optional(),
    accountStatus: AccountStatusSchema.optional(),
  }),
  provisioning: z.object({
    step: ProvisioningStepSchema,
    error: z.string().optional(),
    /** Set when `step` is `FAILED`: the checklist row that stopped. */
    failedStep: z.enum(["ACCOUNT_CREATED", "SUBMITTED", "ACTIVE", "WELCOME_CREDITED", "READY"]).optional(),
  }),
});
export type MeDTO = z.infer<typeof MeSchema>;

export const TestCardSchema = z.object({
  number: z.string().min(1),
  label: z.string().min(1),
  outcome: z.enum(["success", "decline", "3ds"]),
});

export const PublicConfigSchema = z.object({
  currency: z.string().regex(/^[A-Z]{3}$/),
  platformFeePercent: z.number().nonnegative(),
  processingReservePercent: z.number().nonnegative(),
  minMilestoneMinor: z.number().int().positive(),
  maxOfferTotalMinor: z.number().int().positive(),
  maxMilestones: z.number().int().positive(),
  walletRailEnabled: z.boolean(),
  airwallexEnv: z.enum(["demo", "prod"]),
  testCards: z.array(TestCardSchema),
  mocksEnabled: z.boolean(),
});
export type PublicConfigDTO = z.infer<typeof PublicConfigSchema>;

export const DemoAccountSchema = UserSummarySchema.extend({
  email: z.string().email(),
  role: z.enum(["Seller", "Buyer", "Both"]),
});
export type DemoAccountDTO = z.infer<typeof DemoAccountSchema>;

export const SignupInputSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(1).max(200),
  headline: z.string().max(160).optional(),
});
export type SignupInput = z.infer<typeof SignupInputSchema>;

export const LoginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const UserSearchQuerySchema = z.object({
  q: z.string().min(2),
});
export type UserSearchQuery = z.infer<typeof UserSearchQuerySchema>;
