import type { OfferSummaryDTO } from "@/contracts/offers";
import { Money } from "@/components/domain/money";
import { StatusPill } from "@/components/domain/status-pill";
import { UserChip } from "@/components/domain/user-chip";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export function OfferCard({ offer }: { offer: OfferSummaryDTO }) {
  const progress = offer.total.amountMinor === 0 ? 0 : Math.round((offer.released.amountMinor / offer.total.amountMinor) * 100);

  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-md border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{offer.shortRef}</p>
          <h3 className="truncate font-serif text-xl font-medium tracking-tight">{offer.title}</h3>
        </div>
        <Money value={offer.total} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <UserChip user={offer.counterparty} />
        <StatusPill status={offer.status} />
      </div>
      {offer.isWelcomeOffer ? <Badge variant="outline">Welcome offer</Badge> : null}
      {offer.status === "ACTIVE" ? (
        <div className="flex flex-col gap-1">
          <Progress value={progress} aria-label={`${progress}% released`} />
          <p className="text-xs text-muted-foreground">{progress}% released</p>
        </div>
      ) : null}
      {offer.nextAction ? <p className="text-sm font-medium">{offer.nextAction.label}</p> : null}
    </article>
  );
}
