import { z } from "zod";
import { IsoDateTimeSchema, MoneySchema, NonNegativeMoneySchema, pageSchema } from "@/contracts/common";

export const BalanceSchema = z.object({
  currency: z.string().regex(/^[A-Z]{3}$/),
  available: NonNegativeMoneySchema,
  pending: NonNegativeMoneySchema,
  reserved: NonNegativeMoneySchema,
  total: NonNegativeMoneySchema,
});
export type BalanceDTO = z.infer<typeof BalanceSchema>;

export const WalletSchema = z.object({
  account: z.object({
    accountId: z.string().min(1),
    status: z.string().min(1),
    label: z.string().min(1),
  }),
  balances: z.array(BalanceSchema),
  escrow: z.object({
    heldAsBuyer: NonNegativeMoneySchema,
    incomingAsSeller: NonNegativeMoneySchema,
  }),
});
export type WalletDTO = z.infer<typeof WalletSchema>;

export const TransactionSchema = z.object({
  id: z.string().min(1),
  at: IsoDateTimeSchema,
  type: z.enum([
    "TRANSFER_IN",
    "TRANSFER_OUT",
    "CHARGE",
    "SPLIT",
    "SPLIT_REVERSAL",
    "PAYOUT",
    "DEPOSIT",
    "FEE",
    "OTHER",
  ]),
  label: z.string(),
  amount: MoneySchema,
  airwallexType: z.string().optional(),
  reference: z.string().optional(),
});
export type TransactionDTO = z.infer<typeof TransactionSchema>;

export const TransactionPageSchema = pageSchema(TransactionSchema);
export type TransactionPageDTO = z.infer<typeof TransactionPageSchema>;

export const TransactionsQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
});

export const WithdrawalInputSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Enter a dollar amount with up to 2 decimal places."),
});

export const SendFundsInputSchema = z.object({
  recipientId: z.string().min(1),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Enter a dollar amount with up to 2 decimal places."),
});

export const WithdrawalResultSchema = z.object({
  ok: z.literal(true),
  transferId: z.string().min(1),
});
