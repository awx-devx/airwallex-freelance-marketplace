import type { TransactionDTO } from "@/contracts/wallet";
import { formatDay } from "@/components/domain/format";
import { Money } from "@/components/domain/money";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export function TransactionList({
  items,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
}: {
  items: TransactionDTO[];
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}) {
  if (items.length === 0) {
    return <EmptyState title="No transactions" description="Deposits, releases, and payouts will show here." />;
  }

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3 border-b border-border py-3 text-sm">
            <span className="min-w-0">
              <span className="block truncate">{item.label}</span>
              <span className="text-xs text-muted-foreground">{formatDay(item.at)}</span>
            </span>
            <Money value={item.amount} signed className="text-base" muted={item.amount.amountMinor < 0} />
          </li>
        ))}
      </ul>
      {hasMore ? (
        <Button type="button" variant="outline" className="w-fit" loading={loadingMore} onClick={() => onLoadMore?.()}>
          Load more
        </Button>
      ) : null}
    </div>
  );
}
