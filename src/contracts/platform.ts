import { z } from "zod";
import { IsoDateTimeSchema, NonNegativeMoneySchema } from "@/contracts/common";
import { MilestoneStatusSchema, OfferStatusSchema } from "@/contracts/offers";
import { BalanceSchema } from "@/contracts/wallet";

export const PlatformOverviewSchema = z.object({
  platformBalances: z.array(BalanceSchema),
  revenueAccount: z.object({
    accountId: z.string().min(1),
    balances: z.array(BalanceSchema),
  }),
  feesCollected: NonNegativeMoneySchema,
  counts: z.object({
    offers: z.record(OfferStatusSchema, z.number().int().nonnegative()),
    milestones: z.record(MilestoneStatusSchema, z.number().int().nonnegative()),
  }),
  stuck: z.array(
    z.object({
      offerId: z.string().min(1),
      offerTitle: z.string(),
      milestoneId: z.string().min(1),
      milestoneTitle: z.string(),
      status: MilestoneStatusSchema,
      since: IsoDateTimeSchema,
    }),
  ),
});
export type PlatformOverviewDTO = z.infer<typeof PlatformOverviewSchema>;

export const WebhookEventRowSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  objectId: z.string().optional(),
  receivedAt: IsoDateTimeSchema,
  processed: z.boolean(),
  processingError: z.string().optional(),
});
export type WebhookEventRowDTO = z.infer<typeof WebhookEventRowSchema>;

export const DemoAdminUnlockSchema = z.object({
  key: z.string().min(1, "Enter the admin key."),
});
export type DemoAdminUnlockInput = z.infer<typeof DemoAdminUnlockSchema>;
