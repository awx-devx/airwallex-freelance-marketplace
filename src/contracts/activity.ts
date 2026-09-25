import { z } from "zod";
import { IsoDateTimeSchema } from "@/contracts/common";
import { UserSummarySchema } from "@/contracts/users";

export const ActivityItemSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  message: z.string(),
  actor: UserSummarySchema.optional(),
  milestoneId: z.string().optional(),
  createdAt: IsoDateTimeSchema,
});
export type ActivityItemDTO = z.infer<typeof ActivityItemSchema>;

const ApiCallEventSchema = z.object({
  id: z.string().min(1),
  source: z.literal("API_CALL"),
  at: IsoDateTimeSchema,
  method: z.string().min(1),
  path: z.string().min(1),
  status: z.number().int(),
  durationMs: z.number().nonnegative(),
  onBehalfOf: z.string().optional(),
  requestBody: z.unknown().optional(),
  responseBody: z.unknown().optional(),
  errorCode: z.string().optional(),
});

const WebhookEventSchema = z.object({
  id: z.string().min(1),
  source: z.literal("WEBHOOK"),
  at: IsoDateTimeSchema,
  name: z.string().min(1),
  objectId: z.string().optional(),
  processed: z.boolean(),
  processingError: z.string().optional(),
  payload: z.unknown(),
});

export const AirwallexEventSchema = z.discriminatedUnion("source", [ApiCallEventSchema, WebhookEventSchema]);
export type AirwallexEventDTO = z.infer<typeof AirwallexEventSchema>;
