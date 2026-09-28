import { request } from "./client";
import { asObject, readString, type JsonObject } from "./json";

export async function createAccount(body: JsonObject): Promise<JsonObject> {
  return request<JsonObject>("POST", "/api/v1/accounts/create", { body });
}

export async function updateAccount(accountId: string, body: JsonObject): Promise<JsonObject> {
  return request<JsonObject>("POST", `/api/v1/accounts/${accountId}/update`, { body });
}

export async function submitAccount(accountId: string): Promise<JsonObject> {
  return request<JsonObject>("POST", `/api/v1/accounts/${accountId}/submit`, { body: {} });
}

export async function forceAccountStatus(
  accountId: string,
  nextStatus: "ACTIVE" | "SUSPENDED",
  force = true,
): Promise<JsonObject> {
  // SANDBOX: simulation/accounts/{id}/update_status force-activates the account and skips KYC review.
  // https://www.airwallex.com/docs/developer-tools/sandbox-environment/connected-accounts/simulate-connected-account-status-transition
  return request<JsonObject>("POST", `/api/v1/simulation/accounts/${accountId}/update_status`, {
    body: { next_status: nextStatus, force },
  });
}

export async function retrieveAccount(accountId: string): Promise<JsonObject> {
  return request<JsonObject>("GET", `/api/v1/accounts/${accountId}`);
}

/** The platform account behind the access token. GET /api/v1/account */
export async function retrieveCurrentAccount(): Promise<JsonObject> {
  return request<JsonObject>("GET", "/api/v1/account");
}

export function accountIdOf(account: unknown): string | undefined {
  return readString(asObject(account), "id");
}

export function accountStatusOf(account: unknown): string | undefined {
  return readString(asObject(account), "status");
}
