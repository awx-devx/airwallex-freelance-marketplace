import { toAwxAmount } from "@/lib/money";
import { createResource, request } from "./client";
import { asJsonObject, readItems, readString, type JsonObject } from "./json";

export type CreateRefundInput = {
  paymentIntentId: string;
  amountMinor: number;
  currency: string;
  requestId: string;
  reason: string;
  metadata?: Record<string, string>;
  relatedMilestoneId?: string;
};

export function buildRefundBody(input: CreateRefundInput): JsonObject {
  return {
    payment_intent_id: input.paymentIntentId,
    amount: toAwxAmount(input.amountMinor, input.currency),
    request_id: input.requestId,
    reason: input.reason,
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };
}

async function findRefund(input: CreateRefundInput): Promise<JsonObject | undefined> {
  const listed = await request<unknown>("GET", "/api/v1/pa/refunds", {
    query: { payment_intent_id: input.paymentIntentId, page_size: 20 },
  });
  return asJsonObject(readItems(listed).find((item) => readString(item, "request_id") === input.requestId));
}

export async function createRefund(input: CreateRefundInput): Promise<JsonObject> {
  return createResource("/api/v1/pa/refunds/create", buildRefundBody(input), () => findRefund(input), {
    relatedMilestoneId: input.relatedMilestoneId,
  });
}

export async function retrieveRefund(refundId: string): Promise<JsonObject> {
  return request<JsonObject>("GET", `/api/v1/pa/refunds/${refundId}`);
}
