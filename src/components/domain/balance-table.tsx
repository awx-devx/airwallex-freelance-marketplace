import type { BalanceDTO } from "@/contracts/wallet";
import { Money } from "@/components/domain/money";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function BalanceTable({ balances, loading = false }: { balances?: BalanceDTO[]; loading?: boolean }) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2" aria-label="Loading balances">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (!balances || balances.length === 0) {
    return <EmptyState title="No balances" description="A currency balance will show here once the account is active." />;
  }

  return (
    <div className="overflow-x-auto">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Currency</TableHead>
          <TableHead className="text-right">Available</TableHead>
          <TableHead className="text-right">Pending</TableHead>
          <TableHead className="text-right">Reserved</TableHead>
          <TableHead className="text-right">Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {balances.map((balance) => (
          <TableRow key={balance.currency}>
            <TableCell>{balance.currency}</TableCell>
            <TableCell className="text-right">
              <Money value={balance.available} className="text-base" />
            </TableCell>
            <TableCell className="text-right">
              <Money value={balance.pending} className="text-base" muted={balance.pending.amountMinor === 0} />
            </TableCell>
            <TableCell className="text-right">
              <Money value={balance.reserved} className="text-base" muted={balance.reserved.amountMinor === 0} />
            </TableCell>
            <TableCell className="text-right">
              <Money value={balance.total} className="text-base" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    </div>
  );
}
