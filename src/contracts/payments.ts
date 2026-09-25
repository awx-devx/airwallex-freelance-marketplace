import { z } from "zod";
import { NonNegativeMoneySchema } from "@/contracts/common";

export const CardPaymentSessionSchema = z.object({
  offerId: z.string().min(1),
  intentId: z.string().min(1),
  clientSecret: z.string().min(1),
  amount: NonNegativeMoneySchema,
});
export type CardPaymentSessionDTO = z.infer<typeof CardPaymentSessionSchema>;
