"use client";

import type { PlatformOverviewDTO } from "@/contracts/platform";
import { formatDay } from "@/components/domain/format";
import { Money } from "@/components/domain/money";
import { StatusPill } from "@/components/domain/status-pill";
import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMilestoneAction, useOfferSync } from "@/hooks/offers";
import { usePlatformOverview, usePlatformWebhooks } from "@/hooks/platform";
import { ApiError } from "@/lib/api/errors";

// DEMO-ONLY: Any signed-in user can see platform balances and retry stuck milestones.
// PROD: Admin role checks and an audit log.
function StuckRow({ item }: { item: PlatformOverviewDTO["stuck"][number] }) {
  const actions = useMilestoneAction(item.offerId);
  const sync = useOfferSync(item.offerId);

  return (
    <TableRow>
      <TableCell className="max-w-40 truncate">{item.offerTitle}</TableCell>
      <TableCell className="max-w-40 truncate">{item.milestoneTitle}</TableCell>
      <TableCell>
        <StatusPill status={item.status} />
      </TableCell>
      <TableCell>{formatDay(item.since)}</TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" loading={sync.syncNow.isPending} onClick={() => sync.syncNow.mutate()}>
            Sync
          </Button>
          <Button type="button" variant="primary" size="sm" loading={actions.retry.isPending} onClick={() => actions.retry.mutate(item.milestoneId)}>
            Retry
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function PlatformScreen() {
  const overview = usePlatformOverview();
  const webhooks = usePlatformWebhooks();

  if (overview.isLoading) {
    return (
      <div className="flex flex-col gap-3" aria-label="Loading platform">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (overview.isError || !overview.data) {
    return (
      <ErrorState
        message={overview.error instanceof ApiError ? overview.error.message : "Couldn't load the platform."}
        onRetry={() => overview.refetch()}
      />
    );
  }

  const data = overview.data;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Platform" subtitle="Sandbox view of the platform account and the Revenue account. Demo only." />
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-md border border-border bg-card p-5">
          <h2 className="font-medium">Platform</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {data.platformBalances.map((balance) => (
              <li key={balance.currency} className="flex items-center justify-between text-sm">
                <span>{balance.currency} available</span>
                <Money value={balance.available} className="text-base" />
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-md border border-border bg-card p-5">
          <h2 className="font-medium">Revenue account</h2>
          <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{data.revenueAccount.accountId}</p>
          <ul className="mt-3 flex flex-col gap-2">
            {data.revenueAccount.balances.map((balance) => (
              <li key={balance.currency} className="flex items-center justify-between text-sm">
                <span>{balance.currency} available</span>
                <Money value={balance.available} className="text-base" />
              </li>
            ))}
          </ul>
        </section>
      </div>
      <section className="rounded-md border border-border bg-card p-5">
        <p className="text-xs text-muted-foreground">Fees collected</p>
        <Money value={data.feesCollected} />
      </section>
      <Section title="Stuck milestones" count={data.stuck.length}>
        {data.stuck.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing is waiting on Airwallex.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Offer</TableHead>
                <TableHead>Milestone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Since</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.stuck.map((item) => (
                <StuckRow key={item.milestoneId} item={item} />
              ))}
            </TableBody>
          </Table>
        )}
      </Section>
      <Section title="Webhooks">
        {webhooks.isError ? (
          <ErrorState message="Couldn't load webhooks." onRetry={() => webhooks.refetch()} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Object</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>Result</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(webhooks.data ?? []).map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="font-mono text-xs">{event.name}</TableCell>
                  <TableCell className="font-mono text-xs">{event.objectId ?? "—"}</TableCell>
                  <TableCell>{formatDay(event.receivedAt)}</TableCell>
                  <TableCell>{event.processed ? "Processed" : event.processingError ?? "Failed"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>
    </div>
  );
}
