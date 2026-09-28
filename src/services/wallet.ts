import type { BalanceDTO, TransactionDTO, TransactionPageDTO, WalletDTO } from "@/contracts/wallet";
import { TransactionPageSchema, WalletSchema } from "@/contracts/wallet";
import { asObject, readNumber, readString } from "@/lib/airwallex/json";
import { balanceHistory, currentBalances } from "@/lib/airwallex/wallet";
import { getServerConfig } from "@/lib/config";
import { connectDb } from "@/lib/db";
import { fromAwxAmount } from "@/lib/money";
import { Offer } from "@/models/offer";
import type { UserDocument } from "@/models/user";
import { ProvisioningIncomplete } from "@/server/errors";

const HELD_STATUSES = new Set(["FUNDED", "SUBMITTED", "CHANGES_REQUESTED", "RELEASING", "RELEASE_FAILED"]);

export function mapBalances(raw: unknown, currency: string): BalanceDTO[] {
  if (!Array.isArray(raw)) return [];
  const rows: BalanceDTO[] = [];
  for (const item of raw) {
    if (readString(item, "currency") !== currency) continue;
    if ((readString(item, "account_type") ?? "cash") !== "cash") continue;
    const available = fromAwxAmount(readNumber(item, "available_amount") ?? 0, currency);
    const pending = fromAwxAmount(readNumber(item, "pending_amount") ?? 0, currency);
    const reserved = fromAwxAmount(readNumber(item, "reserved_amount") ?? 0, currency);
    rows.push({
      currency,
      available: { amountMinor: available, currency },
      pending: { amountMinor: pending, currency },
      reserved: { amountMinor: reserved, currency },
      total: { amountMinor: available + pending + reserved, currency },
    });
  }
  return rows;
}

export async function walletFor(user: UserDocument): Promise<WalletDTO> {
  const accountId = user.airwallex.accountId;
  if (!accountId || !user.airwallex.accountStatus) {
    throw new ProvisioningIncomplete();
  }
  await connectDb();
  const currency = getServerConfig().currency;
  const [rawBalances, offers] = await Promise.all([
    currentBalances(accountId),
    Offer.find({ $or: [{ buyerId: user._id }, { sellerId: user._id }] }),
  ]);

  const held = (party: "buyer" | "seller") =>
    offers
      .filter((offer) => String(party === "buyer" ? offer.buyerId : offer.sellerId) === String(user._id))
      .flatMap((offer) => offer.milestones)
      .filter((milestone) => HELD_STATUSES.has(milestone.status))
      .reduce((sum, milestone) => sum + milestone.amountMinor, 0);

  return WalletSchema.parse({
    account: {
      accountId,
      status: user.airwallex.accountStatus,
      label: "Airwallex connected account (sandbox)",
    },
    balances: mapBalances(rawBalances, currency),
    escrow: {
      heldAsBuyer: { amountMinor: held("buyer"), currency },
      incomingAsSeller: { amountMinor: held("seller"), currency },
    },
  });
}

const PAGE_SIZE = 10;
const HIDDEN_HISTORY = new Set([
  "PAYMENT_RESERVE_HOLD",
  "PAYMENT_RESERVE_RELEASE",
  "HOLD",
  "HOLD_RELEASE",
  "ISSUING_AUTHORISATION_HOLD",
  "ISSUING_AUTHORISATION_RELEASE",
]);

function postedAt(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const parsed = Date.parse(value.replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
  if (Number.isNaN(parsed)) return undefined;
  return new Date(parsed).toISOString();
}

function historyType(transactionType: string | undefined): TransactionDTO["type"] {
  const raw = (transactionType ?? "").toUpperCase();
  if (raw.includes("SPLIT_REVERSAL")) return "SPLIT_REVERSAL";
  if (raw === "SPLIT") return "SPLIT";
  if (raw === "CHARGE") return "CHARGE";
  if (raw.includes("PAYOUT")) return "PAYOUT";
  if (raw === "FEE") return "FEE";
  if (raw === "DEPOSIT" || raw === "DC_CREDIT" || raw === "DD_CREDIT") return "DEPOSIT";
  if (raw === "TRANSFER_OUT" || raw.endsWith("_DEBIT")) return "TRANSFER_OUT";
  if (raw === "TRANSFER_IN" || raw === "TRANSFER" || raw.endsWith("_CREDIT")) return "TRANSFER_IN";
  return "OTHER";
}

const HISTORY_LABEL: Record<TransactionDTO["type"], string> = {
  TRANSFER_IN: "Transfer in",
  TRANSFER_OUT: "Transfer out",
  CHARGE: "Charge",
  SPLIT: "Funds released",
  SPLIT_REVERSAL: "Split reversal",
  PAYOUT: "Payout",
  DEPOSIT: "Deposit",
  FEE: "Fee",
  OTHER: "Wallet activity",
};

function signedMinor(amountMinor: number, transactionType: string | undefined): number {
  if (amountMinor < 0) return amountMinor;
  const raw = (transactionType ?? "").toUpperCase();
  const outflow =
    raw === "PAYOUT" ||
    raw === "CHARGE" ||
    raw === "FEE" ||
    raw === "TRANSFER_OUT" ||
    raw === "SPLIT_REVERSAL" ||
    raw.endsWith("_DEBIT") ||
    raw.endsWith("_SELL");
  return outflow ? -amountMinor : amountMinor;
}

/** Map `GET /balances/history` into the wallet page. Amounts stay signed minor units. */
export function mapBalanceHistory(raw: unknown, currency: string): TransactionPageDTO {
  const items: TransactionDTO[] = [];
  for (const item of Array.isArray(asObject(raw)?.items) ? (asObject(raw)?.items as unknown[]) : []) {
    const transactionType = readString(item, "transaction_type");
    if (transactionType && HIDDEN_HISTORY.has(transactionType)) continue;
    if ((readString(item, "currency") ?? currency) !== currency) continue;
    const id = readString(item, "id");
    const at = postedAt(readString(item, "posted_at"));
    const amount = readNumber(item, "amount");
    if (!id || !at || amount === undefined) continue;
    const type = historyType(transactionType);
    const description = readString(item, "description");
    items.push({
      id,
      at,
      type,
      label: description || HISTORY_LABEL[type],
      amount: { amountMinor: signedMinor(fromAwxAmount(amount, currency), transactionType), currency },
      ...(transactionType ? { airwallexType: transactionType } : {}),
      ...(readString(item, "source") ? { reference: readString(item, "source") } : {}),
    });
  }
  const pageAfter = readString(raw, "page_after");
  const hasMore = asObject(raw)?.has_more;
  return TransactionPageSchema.parse({
    items,
    ...(pageAfter && hasMore !== false ? { nextCursor: pageAfter } : {}),
  });
}

export async function transactionsFor(user: UserDocument, cursor?: string): Promise<TransactionPageDTO> {
  const accountId = user.airwallex.accountId;
  if (!accountId || !user.airwallex.accountStatus) throw new ProvisioningIncomplete();
  const currency = getServerConfig().currency;
  // AIRWALLEX: page=0 lifts the 7-day default. Later pages pass the previous page_after.
  // https://www.airwallex.com/docs/api/core_resources/balances/history
  const history = await balanceHistory({
    onBehalfOf: accountId,
    currency,
    pageSize: PAGE_SIZE,
    page: cursor ?? 0,
  });
  return mapBalanceHistory(history, currency);
}
