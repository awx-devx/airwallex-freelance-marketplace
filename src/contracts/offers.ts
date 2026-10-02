import { z } from "zod";
import { fromAwxAmount, formatMoney } from "@/lib/money";
import { IsoDateSchema, IsoDateTimeSchema, NonNegativeMoneySchema } from "@/contracts/common";
import { UserSummarySchema } from "@/contracts/users";

export const OfferStatusSchema = z.enum([
  "SENT",
  "AWAITING_PAYMENT",
  "ACTIVE",
  "COMPLETED",
  "CANCELLED",
  "DECLINED",
  "WITHDRAWN",
]);
export type OfferStatus = z.infer<typeof OfferStatusSchema>;

export const MilestoneStatusSchema = z.enum([
  "PENDING_FUNDING",
  "FUNDED",
  "SUBMITTED",
  "CHANGES_REQUESTED",
  "RELEASING",
  "PAID",
  "RELEASE_FAILED",
  "REFUNDING",
  "REFUNDED",
  "REFUND_FAILED",
]);
export type MilestoneStatus = z.infer<typeof MilestoneStatusSchema>;

export const OfferActionSchema = z.enum([
  "ACCEPT_AND_PAY",
  "DECLINE",
  "WITHDRAW",
  "CONTINUE_PAYMENT",
  "CANCEL_PAYMENT",
  "CANCEL_REMAINING",
]);
export type OfferAction = z.infer<typeof OfferActionSchema>;

export const MilestoneActionSchema = z.enum([
  "SUBMIT_DELIVERY",
  "APPROVE",
  "REQUEST_CHANGES",
  "CANCEL",
  "RETRY",
]);
export type MilestoneAction = z.infer<typeof MilestoneActionSchema>;

export const ViewerRoleSchema = z.enum(["BUYER", "SELLER"]);
export type ViewerRole = z.infer<typeof ViewerRoleSchema>;

export const FeeBreakdownSchema = z.object({
  seller: NonNegativeMoneySchema,
  revenue: NonNegativeMoneySchema,
  reserve: NonNegativeMoneySchema,
  fee: NonNegativeMoneySchema,
});
export type FeeBreakdownDTO = z.infer<typeof FeeBreakdownSchema>;

export const DeliverySchema = z.object({
  id: z.string().min(1),
  links: z.array(z.string().url()),
  note: z.string().optional(),
  submittedAt: IsoDateTimeSchema,
  review: z
    .object({
      decision: z.enum(["APPROVED", "CHANGES_REQUESTED"]),
      comment: z.string().optional(),
      reviewedAt: IsoDateTimeSchema,
    })
    .optional(),
});
export type DeliveryDTO = z.infer<typeof DeliverySchema>;

export const ReleaseLegSchema = z.object({
  kind: z.enum(["FUNDS_SPLIT", "CA_TRANSFER", "REFUND"]),
  share: z.enum(["SELLER", "REVENUE", "BUYER_REFUND"]),
  airwallexId: z.string().min(1),
  amount: NonNegativeMoneySchema,
  status: z.string().min(1),
});
export type ReleaseLegDTO = z.infer<typeof ReleaseLegSchema>;

export const MilestoneSchema = z.object({
  id: z.string().min(1),
  index: z.number().int().nonnegative(),
  title: z.string().min(1),
  description: z.string().optional(),
  dueDate: IsoDateSchema.optional(),
  amount: NonNegativeMoneySchema,
  breakdown: FeeBreakdownSchema,
  status: MilestoneStatusSchema,
  isPending: z.boolean(),
  deliveries: z.array(DeliverySchema),
  releaseLegs: z.array(ReleaseLegSchema),
  allowedActions: z.array(MilestoneActionSchema),
  approvedAt: IsoDateTimeSchema.optional(),
  paidAt: IsoDateTimeSchema.optional(),
  refundedAt: IsoDateTimeSchema.optional(),
  lastError: z.string().optional(),
});
export type MilestoneDTO = z.infer<typeof MilestoneSchema>;

export const OfferSummarySchema = z.object({
  id: z.string().min(1),
  shortRef: z.string().min(1),
  title: z.string().min(1),
  status: OfferStatusSchema,
  viewerRole: ViewerRoleSchema,
  counterparty: UserSummarySchema,
  total: NonNegativeMoneySchema,
  released: NonNegativeMoneySchema,
  refunded: NonNegativeMoneySchema,
  milestoneCount: z.number().int().nonnegative(),
  milestoneCounts: z.record(MilestoneStatusSchema, z.number().int().nonnegative()),
  nextAction: z
    .object({
      label: z.string().min(1),
      milestoneId: z.string().optional(),
    })
    .optional(),
  isWelcomeOffer: z.boolean(),
  sentAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type OfferSummaryDTO = z.infer<typeof OfferSummarySchema>;

export const OfferSchema = OfferSummarySchema.omit({ counterparty: true }).extend({
  description: z.string(),
  seller: UserSummarySchema,
  buyer: UserSummarySchema,
  fundingRail: z.enum(["CARD", "WALLET"]).optional(),
  feeSnapshot: z.object({
    platformFeePercent: z.number().nonnegative(),
    processingReservePercent: z.number().nonnegative(),
  }),
  totals: z.object({
    held: NonNegativeMoneySchema,
    released: NonNegativeMoneySchema,
    refunded: NonNegativeMoneySchema,
    fees: FeeBreakdownSchema,
  }),
  milestones: z.array(MilestoneSchema),
  allowedActions: z.array(OfferActionSchema),
  isPending: z.boolean(),
  payment: z
    .object({
      rail: z.enum(["CARD", "WALLET"]),
      status: z.enum(["PENDING", "SUCCEEDED", "FAILED", "CANCELLED"]),
      paymentIntentId: z.string().optional(),
      chargeId: z.string().optional(),
    })
    .optional(),
  acceptedAt: IsoDateTimeSchema.optional(),
  fundedAt: IsoDateTimeSchema.optional(),
  completedAt: IsoDateTimeSchema.optional(),
});
export type OfferDTO = z.infer<typeof OfferSchema>;

const MAJOR_AMOUNT = /^\d+(\.\d{1,2})?$/;

const MilestoneInputSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  amount: z.string().regex(MAJOR_AMOUNT, "Enter a dollar amount with up to 2 decimal places."),
  dueDate: IsoDateSchema.optional(),
});

export type OfferLimits = {
  currency: string;
  minMilestoneMinor: number;
  maxOfferTotalMinor: number;
  maxMilestones: number;
};

export const DEFAULT_OFFER_LIMITS: OfferLimits = {
  currency: "USD",
  minMilestoneMinor: 1_000,
  maxOfferTotalMinor: 900_000,
  maxMilestones: 10,
};

export function createOfferInputSchema(limits: OfferLimits = DEFAULT_OFFER_LIMITS) {
  return z
    .object({
      buyerId: z.string().min(1),
      title: z.string().min(3).max(120),
      description: z.string().max(2000),
      milestones: z.array(MilestoneInputSchema).min(1).max(limits.maxMilestones),
    })
    .superRefine((input, ctx) => {
      if (!Array.isArray(input.milestones)) return;
      let total = 0;
      for (const [index, milestone] of input.milestones.entries()) {
        if (!MAJOR_AMOUNT.test(milestone.amount)) continue;
        const minor = fromAwxAmount(milestone.amount, limits.currency);
        if (minor < limits.minMilestoneMinor) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["milestones", index, "amount"],
            message: `Minimum is ${formatMoney(limits.minMilestoneMinor, limits.currency)}.`,
          });
        }
        total += minor;
      }
      if (total > limits.maxOfferTotalMinor) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["milestones"],
          message: `Offer total can't exceed ${formatMoney(limits.maxOfferTotalMinor, limits.currency)}.`,
        });
      }
    });
}

export const CreateOfferInputSchema = createOfferInputSchema();
export type CreateOfferInput = z.infer<typeof CreateOfferInputSchema>;

const HttpUrlSchema = z
  .string()
  .url()
  .refine((value) => value.startsWith("http://") || value.startsWith("https://"), "Enter an http(s) URL.");

export const SubmitDeliveryInputSchema = z.object({
  links: z.array(HttpUrlSchema).min(1).max(5),
  note: z.string().max(2000).optional(),
});
export type SubmitDeliveryInput = z.infer<typeof SubmitDeliveryInputSchema>;

export const RequestChangesInputSchema = z.object({
  comment: z.string().min(1).max(2000),
});
export type RequestChangesInput = z.infer<typeof RequestChangesInputSchema>;

export const CancelReasonInputSchema = z.object({
  reason: z.string().max(2000).optional(),
});
export type CancelReasonInput = z.infer<typeof CancelReasonInputSchema>;

export const OffersQuerySchema = z.object({
  view: z.enum(["incoming", "buying", "selling"]),
});
export type OffersQuery = z.infer<typeof OffersQuerySchema>;
