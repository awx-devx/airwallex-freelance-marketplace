import type { EscrowLegDTO } from "@/contracts/offers";
import { Money } from "@/components/domain/money";
import { Badge } from "@/components/ui/badge";

const SHARE_LABEL = {
  SELLER: "Seller",
  REVENUE: "Platform revenue",
  BUYER_REFUND: "Refund to buyer",
} as const;

const KIND_LABEL = {
  FUNDS_SPLIT: "Funds split",
  CA_TRANSFER: "Transfer",
  REFUND: "Refund",
} as const;

export function EscrowLegList({ legs }: { legs: EscrowLegDTO[] }) {
  if (legs.length === 0) return <p className="text-sm text-muted-foreground">No escrow legs yet.</p>;

  return (
    <ul className="flex flex-col gap-2">
      {legs.map((leg) => (
        <li key={leg.airwallexId} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
          <span className="min-w-0">
            <span className="font-medium">{KIND_LABEL[leg.kind]}</span>
            <span className="text-muted-foreground"> · {SHARE_LABEL[leg.share]}</span>
            <span className="mt-0.5 block truncate font-mono text-xs text-muted-foreground">{leg.airwallexId}</span>
          </span>
          <span className="flex items-center gap-2">
            <Money value={leg.amount} className="text-base" />
            <Badge variant="outline">{leg.status}</Badge>
          </span>
        </li>
      ))}
    </ul>
  );
}
