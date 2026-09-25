import type { FeeBreakdownDTO } from "@/contracts/offers";
import type { MoneyDTO } from "@/contracts/common";
import { Money } from "@/components/domain/money";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatMoney } from "@/lib/money";
import { breakdown } from "@/services/fees";

function asMoney(amountMinor: number, currency: string): MoneyDTO {
  return { amountMinor, currency };
}

export function resolveFeeBreakdown(
  input: { breakdown: FeeBreakdownDTO } | { amountMinor: number; platformFeePercent: number; processingReservePercent: number; currency?: string },
): FeeBreakdownDTO {
  if ("breakdown" in input) return input.breakdown;
  const currency = input.currency ?? "USD";
  const parts = breakdown(input.amountMinor, {
    platformFeePercent: input.platformFeePercent,
    processingReservePercent: input.processingReservePercent,
  });
  return {
    seller: asMoney(parts.sellerMinor, currency),
    revenue: asMoney(parts.revenueMinor, currency),
    reserve: asMoney(parts.reserveMinor, currency),
    fee: asMoney(parts.feeMinor, currency),
  };
}

function Rows({ value }: { value: FeeBreakdownDTO }) {
  const rows = [
    ["Seller receives", value.seller],
    ["Platform fee", value.fee],
    ["Processing reserve", value.reserve],
    ["Platform revenue", value.revenue],
  ] as const;

  return (
    <dl className="flex flex-col gap-1 text-sm">
      {rows.map(([label, amount]) => (
        <div key={label} className="flex items-baseline justify-between gap-4">
          <dt className="text-muted-foreground">{label}</dt>
          <dd>
            <Money value={amount} size="md" className="text-base" />
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function FeeBreakdown({
  variant,
  value,
}: {
  variant: "inline" | "card" | "tooltip";
  value: FeeBreakdownDTO;
}) {
  if (variant === "inline") {
    return (
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span>
          Seller <Money value={value.seller} className="text-base text-foreground" />
        </span>
        <span>
          Fee <Money value={value.fee} className="text-base text-foreground" />
        </span>
        <span>
          Reserve <Money value={value.reserve} className="text-base text-foreground" />
        </span>
      </p>
    );
  }

  if (variant === "tooltip") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button" variant="link" size="sm" className="h-auto px-0">
            Fee split
          </Button>
        </TooltipTrigger>
        <TooltipContent className="block w-56 items-start p-3">
          <span className="block">Seller {formatMoney(value.seller.amountMinor, value.seller.currency)}</span>
          <span className="block">Fee {formatMoney(value.fee.amountMinor, value.fee.currency)}</span>
          <span className="block">Reserve {formatMoney(value.reserve.amountMinor, value.reserve.currency)}</span>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="rounded-md border border-border bg-background p-4">
      <p className="mb-2 text-sm font-medium">Fee split</p>
      <Rows value={value} />
    </div>
  );
}
