"use client";

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import type { MilestoneAction, MilestoneDTO, ViewerRole } from "@/contracts/offers";
import { cardReleaseAccepted } from "@/contracts/permissions";
import { formatDay } from "@/components/domain/format";
import { Money } from "@/components/domain/money";
import { releasedAwaitingSettlement } from "@/components/domain/status";
import { StatusPill } from "@/components/domain/status-pill";
import { DeliveryForm } from "@/components/domain/delivery-form";
import { DeliveryView } from "@/components/domain/delivery-view";
import { EscrowLegList } from "@/components/domain/escrow-leg-list";
import { ReviewActions } from "@/components/domain/review-actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { formatMoney } from "@/lib/money";

export function MilestoneCard({
  milestone,
  payeeName,
  viewerRole,
  timedOut = false,
  pendingAction,
  onAction,
  onSync,
}: {
  milestone: MilestoneDTO;
  payeeName: string;
  viewerRole: ViewerRole;
  timedOut?: boolean;
  pendingAction?: MilestoneAction;
  onAction?: (action: MilestoneAction, payload?: { links?: string[]; note?: string; comment?: string; reason?: string }) => void;
  onSync?: () => void;
}) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const latest = milestone.deliveries.at(-1);
  const canDeliver = milestone.allowedActions.includes("SUBMIT_DELIVERY");
  const canReview = milestone.allowedActions.includes("APPROVE") || milestone.allowedActions.includes("REQUEST_CHANGES");
  const canCancel = milestone.allowedActions.includes("CANCEL");
  const canRetry = milestone.allowedActions.includes("RETRY");
  const released = cardReleaseAccepted(milestone);

  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-md border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Milestone {milestone.index + 1}</p>
          <h3 className="font-serif text-xl font-medium tracking-tight">{milestone.title}</h3>
          {milestone.description ? <p className="mt-1 text-sm text-muted-foreground">{milestone.description}</p> : null}
        </div>
        <div className="flex items-start gap-2">
          <Money value={milestone.amount} />
          {canCancel ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon" aria-label="Milestone actions">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setCancelOpen(true)}>Cancel milestone</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>
      <StatusPill status={milestone.status} visual={released ? releasedAwaitingSettlement : undefined} />
      {released ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-muted-foreground">
            {viewerRole === "SELLER"
              ? "Released to you. Airwallex settles this to your wallet later, often the next day. You can leave this page."
              : `Released to ${payeeName}. Airwallex settles this to their wallet later, often the next day. You can leave this page.`}
          </p>
          <EscrowLegList legs={milestone.escrowLegs} />
          <Button type="button" variant="outline" size="sm" onClick={() => onSync?.()}>
            Sync
          </Button>
        </div>
      ) : milestone.isPending ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Spinner size="sm" />
          <span>{timedOut ? "Still waiting" : "Waiting for Airwallex…"}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => onSync?.()}>
            Sync
          </Button>
        </div>
      ) : null}
      {milestone.lastError ? <p className="text-sm text-danger">{milestone.lastError}</p> : null}
      {canRetry ? (
        <Button type="button" variant="outline" className="w-fit" loading={pendingAction === "RETRY"} onClick={() => onAction?.("RETRY")}>
          Retry
        </Button>
      ) : null}
      {milestone.status === "PAID" && milestone.paidAt ? (
        <p className="text-sm">
          Paid to {payeeName} · {formatDay(milestone.paidAt)}
        </p>
      ) : null}
      {milestone.status === "PAID" || milestone.status === "REFUNDED" ? <EscrowLegList legs={milestone.escrowLegs} /> : null}
      {latest && (canReview || milestone.status === "CHANGES_REQUESTED" || milestone.status === "PAID") ? (
        <DeliveryView delivery={latest} />
      ) : null}
      {canDeliver ? (
        <DeliveryForm
          onSubmit={(input) => onAction?.("SUBMIT_DELIVERY", input)}
          submitting={pendingAction === "SUBMIT_DELIVERY"}
        />
      ) : null}
      {canReview && latest ? (
        <ReviewActions
          amount={milestone.amount}
          approving={pendingAction === "APPROVE"}
          onApprove={() => onAction?.("APPROVE")}
          onRequestChanges={(comment) => onAction?.("REQUEST_CHANGES", { comment })}
        />
      ) : null}
      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel milestone"
        description={`${formatMoney(milestone.amount.amountMinor, milestone.amount.currency)} will be refunded to the buyer.`}
        confirmLabel="Cancel milestone"
        destructive
        onConfirm={(reason) => {
          onAction?.("CANCEL", { reason });
          setCancelOpen(false);
        }}
      />
    </article>
  );
}
