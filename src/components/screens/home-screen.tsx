"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { OfferSummaryDTO } from "@/contracts/offers";
import { OfferCard } from "@/components/domain/offer-card";
import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOffers } from "@/hooks/offers";
import { useMe } from "@/hooks/session";
import type { OfferView } from "@/hooks/queryKeys";
import { ApiError } from "@/lib/api/errors";

const TABS: { id: OfferView; label: string }[] = [
  { id: "incoming", label: "Incoming" },
  { id: "buying", label: "Buying" },
  { id: "selling", label: "Selling" },
];

function OfferList({ offers, empty }: { offers: OfferSummaryDTO[]; empty: ReactNode }) {
  if (offers.length === 0) return empty;
  return (
    <div className="flex flex-col gap-3">
      {offers.map((offer) => (
        <Link key={offer.id} href={`/offers/${offer.id}`} className="block rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          <OfferCard offer={offer} />
        </Link>
      ))}
    </div>
  );
}

function OfferSection({
  view,
  title,
  empty,
}: {
  view: OfferView;
  title: string;
  empty: ReactNode;
}) {
  const query = useOffers(view);

  if (query.isLoading) {
    return (
      <Section title={title}>
        <div className="flex flex-col gap-3" aria-label={`Loading ${title}`}>
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      </Section>
    );
  }

  if (query.isError) {
    return (
      <Section title={title}>
        <ErrorState message={query.error instanceof ApiError ? query.error.message : `Couldn't load ${title.toLowerCase()}.`} onRetry={() => query.refetch()} />
      </Section>
    );
  }

  const offers = query.data ?? [];
  return (
    <Section title={title} count={offers.length}>
      <OfferList offers={offers} empty={empty} />
    </Section>
  );
}

export function HomeScreen() {
  const router = useRouter();
  const search = useSearchParams();
  const me = useMe();
  const requested = search.get("tab");
  const tab = TABS.some((item) => item.id === requested) ? (requested as OfferView) : "incoming";
  const firstName = me.data?.name.split(" ")[0] ?? "there";
  const sellingEmpty = (
    <EmptyState
      title="No offers sent"
      description="Send a milestone offer and the buyer pays up front."
      action={
        <Button type="button" variant="primary" onClick={() => router.push("/offers/new")}>
          Create your first offer
        </Button>
      }
    />
  );
  const sections = {
    incoming: (
      <OfferSection
        view="incoming"
        title="Incoming offers"
        empty={<EmptyState title="No offers yet" description="They'll appear here when someone sends you one." />}
      />
    ),
    buying: (
      <OfferSection
        view="buying"
        title="Buying"
        empty={<EmptyState title="No contracts yet" description="Offers you pay for will show up here." />}
      />
    ),
    selling: <OfferSection view="selling" title="Selling" empty={sellingEmpty} />,
  };

  function selectTab(value: string) {
    const params = new URLSearchParams(search.toString());
    params.set("tab", value);
    router.replace(`/?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={`Hi ${firstName}`} subtitle="Offers waiting on you, and the contracts you're already in." />
      <div className="md:hidden">
        <Tabs value={tab} onValueChange={selectTab}>
          <TabsList className="w-full">
            {TABS.map((item) => (
              <TabsTrigger key={item.id} value={item.id}>
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {TABS.map((item) => (
            <TabsContent key={item.id} value={item.id} className="pt-4">
              {sections[item.id]}
            </TabsContent>
          ))}
        </Tabs>
      </div>
      <div className="hidden flex-col gap-10 md:flex">
        {sections.incoming}
        {sections.buying}
        {sections.selling}
      </div>
    </div>
  );
}
