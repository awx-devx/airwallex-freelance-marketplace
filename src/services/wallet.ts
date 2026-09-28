import type { BalanceDTO, WalletDTO } from "@/contracts/wallet";
import { WalletSchema } from "@/contracts/wallet";
import { readNumber, readString } from "@/lib/airwallex/json";
import { currentBalances } from "@/lib/airwallex/wallet";
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
