import { request } from "@/lib/airwallex/client";
import type { JsonObject } from "@/lib/airwallex/json";
import { toAwxAmountString } from "@/lib/money";

/**
 * DEMO-ONLY: Every withdrawal pays this shared sandbox bank account.
 * PROD: Collect and store the user's own beneficiary, then pass that `beneficiary_id`.
 * SANDBOX: US ACH details from the create-transfer example.
 * https://www.airwallex.com/docs/payments-for-platforms/pay-out-funds/create-a-transfer.md
 */
export const SANDBOX_WITHDRAWAL_BENEFICIARY = {
  address: {
    city: "Seattle",
    country_code: "US",
    postcode: "98104",
    state: "Washington",
    street_address: "412 5th Avenue",
  },
  bank_details: {
    account_currency: "USD",
    account_name: "John Walker",
    account_number: "50001121",
    account_routing_type1: "aba",
    account_routing_value1: "021000021",
    bank_country_code: "US",
    bank_account_category: "Checking",
    local_clearing_system: "ACH",
  },
  company_name: "John Walker",
  entity_type: "COMPANY",
  type: "BANK_ACCOUNT",
} as const;

export async function createPayoutTransfer(input: {
  requestId: string;
  amountMinor: number;
  currency: string;
  onBehalfOf: string;
  reference: string;
  relatedUserId?: string;
}): Promise<JsonObject> {
  const beneficiary: JsonObject = {
    address: { ...SANDBOX_WITHDRAWAL_BENEFICIARY.address },
    bank_details: { ...SANDBOX_WITHDRAWAL_BENEFICIARY.bank_details },
    company_name: SANDBOX_WITHDRAWAL_BENEFICIARY.company_name,
    entity_type: SANDBOX_WITHDRAWAL_BENEFICIARY.entity_type,
    type: SANDBOX_WITHDRAWAL_BENEFICIARY.type,
  };
  return request<JsonObject>("POST", "/api/v1/transfers/create", {
    onBehalfOf: input.onBehalfOf,
    relatedUserId: input.relatedUserId,
    body: {
      beneficiary,
      transfer_amount: toAwxAmountString(input.amountMinor, input.currency),
      transfer_currency: input.currency,
      source_currency: input.currency,
      transfer_method: "LOCAL",
      reason: "transfer_to_own_account",
      reference: input.reference,
      request_id: input.requestId,
    },
  });
}
