import type { WalletDTO } from "@/contracts/wallet";
import { Badge } from "@/components/ui/badge";

export function AccountCard({ account }: { account: WalletDTO["account"] }) {
  const actionRequired = account.status === "ACTION_REQUIRED";

  return (
    <article className="flex flex-col gap-2 rounded-md border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">{account.label}</h3>
        <Badge variant={actionRequired ? "warning" : "success"}>{actionRequired ? "Action required" : account.status}</Badge>
      </div>
      <p className="truncate font-mono text-xs text-muted-foreground">{account.accountId}</p>
      {actionRequired ? <p className="text-sm text-muted-foreground">Airwallex needs more information before payouts can continue.</p> : null}
    </article>
  );
}
