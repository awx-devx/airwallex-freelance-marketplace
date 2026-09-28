import { toAwxAmountString } from "@/lib/money";
import { createResource, request } from "./client";
import { asJsonObject, readItems, readString, type JsonObject } from "./json";

/**
 * AIRWALLEX: `reason` is an enum, not free text.
 * https://www.airwallex.com/docs/api/scale/charges/create
 * https://www.airwallex.com/docs/api/scale/connected_account_transfers/create
 */
export const SCALE_REASONS = [
  "wages_salary",
  "donation_charitable_contribution",
  "personal_remittance",
  "transfer_to_own_account",
  "pension",
  "family_support",
  "living_expenses",
  "education_training",
  "travel",
  "investment_proceeds",
  "investment_capital",
  "loan_credit_repayment",
  "taxes",
  "goods_purchased",
  "business_expenses",
  "medical_services",
  "professional_business_services",
  "technical_services",
  "other_services",
  "construction",
  "freight",
  "real_estate",
] as const;

export type ScaleReason = (typeof SCALE_REASONS)[number];

type ScaleMovementInput = {
  amountMinor: number;
  currency: string;
  requestId: string;
  reason: ScaleReason;
  reference: string;
  relatedOfferId?: string;
};

function assertReference(reference: string): string {
  if (reference.length < 1 || reference.length > 140) {
    throw new Error(`reference must be 1–140 characters, received ${reference.length}`);
  }
  return reference;
}

export async function currentBalances(onBehalfOf?: string): Promise<unknown> {
  return request<unknown>("GET", "/api/v1/balances/current", { onBehalfOf });
}

export async function balanceHistory(input: {
  onBehalfOf?: string;
  currency?: string;
  pageSize?: number;
  /** `0` asks for history beyond the default 7-day window. Later pages pass `page_after`. */
  page?: string | number;
}): Promise<unknown> {
  return request<unknown>("GET", "/api/v1/balances/history", {
    onBehalfOf: input.onBehalfOf,
    query: {
      currency: input.currency,
      page_size: input.pageSize ?? 10,
      page: input.page ?? 0,
    },
  });
}

export async function createCharge(
  input: ScaleMovementInput & { source: string },
): Promise<JsonObject> {
  const body: JsonObject = {
    amount: toAwxAmountString(input.amountMinor, input.currency),
    currency: input.currency,
    source: input.source,
    reason: input.reason,
    reference: assertReference(input.reference),
    request_id: input.requestId,
  };
  return createResource("/api/v1/charges/create", body, async () => {
    const listed = await request<unknown>("GET", "/api/v1/charges", {
      query: { request_id: input.requestId, page_size: 10 },
    });
    return asJsonObject(readItems(listed).find((item) => readString(item, "request_id") === input.requestId));
  }, { relatedOfferId: input.relatedOfferId });
}

export async function retrieveCharge(chargeId: string): Promise<JsonObject> {
  return request<JsonObject>("GET", `/api/v1/charges/${chargeId}`);
}

export async function createConnectedAccountTransfer(
  input: ScaleMovementInput & { destination: string },
): Promise<JsonObject> {
  const body: JsonObject = {
    amount: toAwxAmountString(input.amountMinor, input.currency),
    currency: input.currency,
    destination: input.destination,
    reason: input.reason,
    reference: assertReference(input.reference),
    request_id: input.requestId,
  };
  return createResource("/api/v1/connected_account_transfers/create", body, async () => {
    const listed = await request<unknown>("GET", "/api/v1/connected_account_transfers", {
      query: { request_id: input.requestId, page_size: 10 },
    });
    return asJsonObject(readItems(listed).find((item) => readString(item, "request_id") === input.requestId));
  }, { relatedOfferId: input.relatedOfferId });
}

export async function retrieveConnectedAccountTransfer(transferId: string): Promise<JsonObject> {
  return request<JsonObject>("GET", `/api/v1/connected_account_transfers/${transferId}`);
}
