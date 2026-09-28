import { toAwxAmount } from "@/lib/money";
import { createResource, request } from "./client";
import { asJsonObject, readItems, readString, type JsonObject } from "./json";

export type CreatePaymentIntentInput = {
  amountMinor: number;
  currency: string;
  merchantOrderId: string;
  requestId: string;
  connectedAccountId: string;
  metadata?: Record<string, string>;
  returnUrl?: string;
  relatedOfferId?: string;
};

export function buildPaymentIntentBody(input: CreatePaymentIntentInput): JsonObject {
  // AIRWALLEX: do not send funds_split_data. Splits created that way auto-release and cannot be held.
  // https://www.airwallex.com/docs/api/payments/funds_splits/create
  return {
    amount: toAwxAmount(input.amountMinor, input.currency),
    currency: input.currency,
    merchant_order_id: input.merchantOrderId,
    request_id: input.requestId,
    connected_account_id: input.connectedAccountId,
    ...(input.metadata ? { metadata: input.metadata } : {}),
    ...(input.returnUrl ? { return_url: input.returnUrl } : {}),
  };
}

async function findPaymentIntent(input: CreatePaymentIntentInput): Promise<JsonObject | undefined> {
  const listed = await request<unknown>("GET", "/api/v1/pa/payment_intents", {
    query: { merchant_order_id: input.merchantOrderId, page_size: 10 },
  });
  return asJsonObject(readItems(listed).find((item) => readString(item, "request_id") === input.requestId));
}

export async function createPaymentIntent(input: CreatePaymentIntentInput): Promise<JsonObject> {
  return createResource(
    "/api/v1/pa/payment_intents/create",
    buildPaymentIntentBody(input),
    () => findPaymentIntent(input),
    { relatedOfferId: input.relatedOfferId },
  );
}

export async function retrievePaymentIntent(paymentIntentId: string): Promise<JsonObject> {
  return request<JsonObject>("GET", `/api/v1/pa/payment_intents/${paymentIntentId}`);
}
