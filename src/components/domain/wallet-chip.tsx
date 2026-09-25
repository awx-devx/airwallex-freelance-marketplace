import type { BalanceDTO } from "@/contracts/wallet";
import { Money } from "@/components/domain/money";
import { Skeleton } from "@/components/ui/skeleton";

export function WalletChip({
  balance,
  loading = false,
  error = false,
}: {
  balance?: BalanceDTO;
  loading?: boolean;
  error?: boolean;
}) {
  if (loading) return <Skeleton className="h-6 w-24" aria-label="Loading balance" />;
  if (error || !balance) return <span className="font-serif text-xl text-muted-foreground">—</span>;

  return <Money value={balance.available} className="text-base" />;
}
