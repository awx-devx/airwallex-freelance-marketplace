import { z } from "zod";

export const IsoDateTimeSchema = z.string().datetime();
export const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.");

export const MoneySchema = z.object({
  amountMinor: z.number().int(),
  currency: z.string().regex(/^[A-Z]{3}$/),
});
export type MoneyDTO = z.infer<typeof MoneySchema>;

export const NonNegativeMoneySchema = MoneySchema.extend({
  amountMinor: z.number().int().nonnegative(),
});

export const ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "VALIDATION_FAILED",
  "INVALID_STATE",
  "INSUFFICIENT_BALANCE",
  "EMAIL_TAKEN",
  "INVALID_CREDENTIALS",
  "PROVISIONING_INCOMPLETE",
  "AIRWALLEX_ERROR",
  "INTERNAL",
] as const;

export const ErrorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const ErrorSchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
    fieldErrors: z.record(z.array(z.string())).optional(),
    airwallex: z
      .object({
        code: z.string().optional(),
        traceId: z.string().optional(),
      })
      .optional(),
  }),
});
export type ErrorDTO = z.infer<typeof ErrorSchema>;

export const OkSchema = z.object({ ok: z.literal(true) });
export type OkDTO = z.infer<typeof OkSchema>;

export function pageSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    nextCursor: z.string().optional(),
  });
}
export type Page<T> = { items: T[]; nextCursor?: string };
