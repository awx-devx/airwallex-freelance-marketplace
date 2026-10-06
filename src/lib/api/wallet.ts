import { OkSchema } from "@/contracts/common";
import {
  TransactionPageSchema,
  WalletSchema,
  WithdrawalResultSchema,
  type SendFundsInput,
  type WithdrawalInput,
} from "@/contracts/wallet";
import { request } from "@/lib/api/transport";

export const wallet = {
  get: () => request("GET", "/api/wallet", undefined, undefined, WalletSchema),
  transactions: (query?: { cursor?: string }) =>
    request("GET", "/api/wallet/transactions", undefined, { cursor: query?.cursor }, TransactionPageSchema),
  withdraw: (body: WithdrawalInput) =>
    request("POST", "/api/wallet/withdrawals", body, undefined, WithdrawalResultSchema),
  send: (body: SendFundsInput) => request("POST", "/api/wallet/sends", body, undefined, OkSchema),
};
