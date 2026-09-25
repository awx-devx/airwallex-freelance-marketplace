"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { MilestoneDTO, ViewerRole } from "@/contracts/offers";
import { ActivityTimeline } from "@/components/domain/activity-timeline";
import { AirwallexActivityPanel } from "@/components/domain/airwallex-activity-panel";
import { EscrowSummary } from "@/components/domain/escrow-summary";
import { MilestoneCard } from "@/components/domain/milestone-card";
import { OfferActionBar } from "@/components/domain/offer-action-bar";
import { OfferHeader } from "@/components/domain/offer-header";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { KitSection, Variant } from "@/components/dev/kit-section";
import { milestoneFor, payeeName, sampleActivity, sampleEvents, seedOffer } from "@/components/dev/kit-fixtures";

function OfferComposite({ offerId, userId, title }: { offerId: string; userId: string; title: string }) {
  const offer = seedOffer(offerId, userId);
  return (
    <Variant caption={title} className="@min-[720px]:col-span-2">
      <div className="flex flex-col gap-5">
        <OfferHeader offer={offer} />
        <OfferActionBar offer={offer} onAction={(action) => toast(`Would ${action.toLowerCase().replaceAll("_", " ")}`)} />
        <EscrowSummary totals={offer.totals} />
        {offer.milestones.map((milestone) => (
          <MilestoneCard key={milestone.id} milestone={milestone} payeeName={offer.seller.name} />
        ))}
        <ActivityTimeline items={offer.id === "off_social" ? sampleActivity : []} />
        <AirwallexActivityPanel events={offer.id === "off_social" ? sampleEvents : []} />
      </div>
    </Variant>
  );
}

function ReleaseSimulation() {
  const [milestone, setMilestone] = useState<MilestoneDTO>(() => milestoneFor("SUBMITTED", "BUYER"));
  const [approving, setApproving] = useState(false);

  return (
    <MilestoneCard
      milestone={milestone}
      payeeName={payeeName}
      pendingAction={approving ? "APPROVE" : undefined}
      onAction={(action) => {
        if (action !== "APPROVE") return;
        setApproving(true);
        window.setTimeout(() => {
          setApproving(false);
          setMilestone(milestoneFor("RELEASING", "BUYER"));
          window.setTimeout(() => setMilestone(milestoneFor("PAID", "BUYER")), 2500);
        }, 600);
      }}
    />
  );
}

export function CompositesSection({ viewerRole }: { viewerRole: ViewerRole }) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <KitSection id="offer-composite" title="Offer" note="The offer screen, assembled from fixtures. Switch buyer and seller in the toolbar.">
        <OfferComposite offerId="off_coffee" userId={viewerRole === "BUYER" ? "usr_sam" : "usr_maya"} title={`Offer / incoming / ${viewerRole}`} />
        <OfferComposite offerId="off_social" userId={viewerRole === "BUYER" ? "usr_hannah" : "usr_maya"} title={`Offer / active / ${viewerRole}`} />
        <OfferComposite offerId="off_copy" userId={viewerRole === "BUYER" ? "usr_omar" : "usr_priya"} title={`Offer / completed / ${viewerRole}`} />
      </KitSection>
      <KitSection id="interactions" title="Interactions" note="Toasts, a confirm dialog, and a release that settles locally.">
        <Variant caption="Toast / success">
          <Button type="button" onClick={() => toast.success("Milestone released")}>
            Show toast
          </Button>
        </Variant>
        <Variant caption="Dialog / confirm">
          <Button type="button" variant="outline" onClick={() => setConfirmOpen(true)}>
            Cancel milestone
          </Button>
          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title="Cancel milestone"
            description="$400.00 will be refunded to the buyer."
            confirmLabel="Cancel milestone"
            destructive
            onConfirm={() => {
              toast("Milestone cancelled");
              setConfirmOpen(false);
            }}
          />
        </Variant>
        <Variant caption="MilestoneCard / releasing then paid" className="@min-[720px]:col-span-2">
          <ReleaseSimulation />
        </Variant>
      </KitSection>
    </>
  );
}
