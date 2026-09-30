"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { MilestoneAction, OfferAction } from "@/contracts/offers";
import { ActivityTimeline } from "@/components/domain/activity-timeline";
import { AirwallexActivityPanel } from "@/components/domain/airwallex-activity-panel";
import { EscrowSummary } from "@/components/domain/escrow-summary";
import { FeeBreakdown } from "@/components/domain/fee-breakdown";
import { MilestoneCard } from "@/components/domain/milestone-card";
import { OfferActionBar } from "@/components/domain/offer-action-bar";
import { OfferHeader } from "@/components/domain/offer-header";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useCancelPayment, useMilestoneAction, useOffer, useOfferAction, useOfferActivity, useOfferAirwallexEvents, useOfferSync } from "@/hooks/offers";
import { ApiError } from "@/lib/api/errors";

export function OfferScreen({ id }: { id: string }) {
  const router = useRouter();
  const offerQuery = useOffer(id);
  const activity = useOfferActivity(id);
  const offer = offerQuery.data;
  const sync = useOfferSync(id, offer);
  const actions = useOfferAction(id);
  const milestones = useMilestoneAction(id);
  const cancelPayment = useCancelPayment(id);
  const [panelOpen, setPanelOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const events = useOfferAirwallexEvents(id, { enabled: panelOpen });

  if (offerQuery.isLoading) {
    return (
      <div className="flex flex-col gap-3" aria-label="Loading offer">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (offerQuery.isError || !offer) {
    const error = offerQuery.error;
    const message =
      error instanceof ApiError && error.status === 404
        ? "Offer not found"
        : error instanceof ApiError && error.status === 403
          ? "You're not part of this offer"
          : error instanceof ApiError
            ? error.message
            : "Couldn't load this offer.";
    return <ErrorState message={message} onRetry={() => offerQuery.refetch()} />;
  }

  const pendingAction: OfferAction | undefined = actions.decline.isPending
    ? "DECLINE"
    : actions.withdraw.isPending
      ? "WITHDRAW"
      : actions.cancelRemaining.isPending
        ? "CANCEL_REMAINING"
        : cancelPayment.isPending
          ? "CANCEL_PAYMENT"
          : undefined;

  function onOfferAction(action: OfferAction) {
    if (action === "ACCEPT_AND_PAY" || action === "CONTINUE_PAYMENT") {
      router.push(`/offers/${id}/pay`);
      return;
    }
    if (action === "DECLINE") actions.decline.mutate();
    if (action === "WITHDRAW") actions.withdraw.mutate();
    if (action === "CANCEL_PAYMENT") cancelPayment.mutate();
    if (action === "CANCEL_REMAINING") setCancelOpen(true);
  }

  function pendingMilestone(milestoneId: string): MilestoneAction | undefined {
    if (milestones.submitDelivery.isPending && milestones.submitDelivery.variables?.milestoneId === milestoneId) return "SUBMIT_DELIVERY";
    if (milestones.requestChanges.isPending && milestones.requestChanges.variables?.milestoneId === milestoneId) return "REQUEST_CHANGES";
    if (milestones.approve.isPending && milestones.approve.variables === milestoneId) return "APPROVE";
    if (milestones.cancel.isPending && milestones.cancel.variables?.milestoneId === milestoneId) return "CANCEL";
    if (milestones.retry.isPending && milestones.retry.variables === milestoneId) return "RETRY";
    return undefined;
  }

  function onMilestone(milestoneId: string, action: MilestoneAction, payload?: { links?: string[]; note?: string; comment?: string; reason?: string }) {
    if (action === "SUBMIT_DELIVERY") {
      milestones.submitDelivery.mutate({ milestoneId, links: payload?.links ?? [], note: payload?.note });
    }
    if (action === "REQUEST_CHANGES" && payload?.comment) {
      milestones.requestChanges.mutate({ milestoneId, comment: payload.comment });
    }
    if (action === "APPROVE") milestones.approve.mutate(milestoneId);
    if (action === "CANCEL") milestones.cancel.mutate({ milestoneId, reason: payload?.reason });
    if (action === "RETRY") milestones.retry.mutate(milestoneId);
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        Home
      </Link>
      <OfferHeader offer={offer} />
      {offer.description ? <p className="max-w-2xl text-sm text-muted-foreground">{offer.description}</p> : null}
      <OfferActionBar offer={offer} pendingAction={pendingAction} onAction={onOfferAction} />
      <EscrowSummary totals={offer.totals} />
      <FeeBreakdown variant="card" value={offer.totals.fees} />
      <div className="flex flex-col gap-3">
        {offer.milestones.map((milestone) => (
          <MilestoneCard
            key={milestone.id}
            milestone={milestone}
            payeeName={offer.seller.name}
            viewerRole={offer.viewerRole}
            timedOut={sync.timedOut && milestone.isPending}
            pendingAction={pendingMilestone(milestone.id)}
            onSync={() => sync.syncNow.mutate()}
            onAction={(action, payload) => onMilestone(milestone.id, action, payload)}
          />
        ))}
      </div>
      {activity.isError ? (
        <ErrorState message="Couldn't load activity." onRetry={() => activity.refetch()} />
      ) : (
        <ActivityTimeline items={activity.data ?? []} />
      )}
      <AirwallexActivityPanel events={events.data ?? []} open={panelOpen} onOpenChange={setPanelOpen} />
      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel remaining milestones?"
        description="Milestones that haven't been released will be refunded to the buyer."
        confirmLabel="Cancel remaining"
        destructive
        onConfirm={(reason) => actions.cancelRemaining.mutate(reason || undefined)}
      />
    </div>
  );
}
