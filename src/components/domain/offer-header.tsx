import type { OfferDTO } from "@/contracts/offers";
import { Money } from "@/components/domain/money";
import { StatusPill } from "@/components/domain/status-pill";
import { UserChip } from "@/components/domain/user-chip";

export function OfferHeader({ offer }: { offer: OfferDTO }) {
  return (
    <header className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{offer.shortRef}</p>
          <h1 className="font-serif text-3xl font-medium tracking-tight">{offer.title}</h1>
        </div>
        <Money value={offer.total} size="lg" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill status={offer.status} />
        <span className="text-xs text-muted-foreground">{offer.viewerRole === "BUYER" ? "You pay" : "You receive"}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <UserChip user={offer.seller} subtitle="Seller" />
        <span aria-hidden>→</span>
        <UserChip user={offer.buyer} subtitle="Buyer" />
      </div>
    </header>
  );
}
