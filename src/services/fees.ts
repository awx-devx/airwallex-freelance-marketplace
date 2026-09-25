export type FeeConfig = {
  platformFeePercent: number;
  processingReservePercent: number;
};

export type FeeBreakdownMinor = {
  sellerMinor: number;
  revenueMinor: number;
  reserveMinor: number;
  feeMinor: number;
};

/**
 * Round half up for `amountMinor * percent / 100`.
 * `percent` is a percentage (10 means 10%), to 2 decimal places.
 */
function shareMinor(amountMinor: number, percent: number): number {
  if (!Number.isFinite(percent) || percent < 0) {
    throw new Error("Fee percent must be a non-negative number.");
  }
  const basisPoints = Math.round(percent * 100);
  const numerator = amountMinor * basisPoints;
  return Math.floor((numerator + 5_000) / 10_000);
}

/** docs/03 §4. Seller, revenue, and reserve sum to the milestone amount. */
export function breakdown(amountMinor: number, config: FeeConfig): FeeBreakdownMinor {
  if (!Number.isInteger(amountMinor) || amountMinor < 0) {
    throw new Error(`Milestone amount must be a non-negative integer, received ${amountMinor}`);
  }

  const fee = shareMinor(amountMinor, config.platformFeePercent);
  const reserve = shareMinor(amountMinor, config.processingReservePercent);
  const seller = amountMinor - fee;
  const revenue = fee - reserve;

  if (seller < 0 || revenue < 0 || reserve < 0) {
    throw new Error(
      "Fee breakdown produced a negative share. Lower the processing reserve or raise the platform fee.",
    );
  }

  return {
    sellerMinor: seller,
    revenueMinor: revenue,
    reserveMinor: reserve,
    feeMinor: fee,
  };
}
