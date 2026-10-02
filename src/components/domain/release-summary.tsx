import type { OfferDTO } from "@/contracts/offers";
import { Money } from "@/components/domain/money";

export function ReleaseSummary({ totals }: { totals: OfferDTO["totals"] }) {
  const rows = [
    ["Awaiting release", totals.held],
    ["Released", totals.released],
    ["Refunded", totals.refunded],
  ] as const;

  return (
    <div className="rounded-md border border-border bg-card p-5">
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {rows.map(([label, amount]) => (
          <div key={label}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1">
              <Money value={amount} muted={amount.amountMinor === 0} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
