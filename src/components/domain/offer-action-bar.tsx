import type { OfferAction, OfferDTO } from "@/contracts/offers";
import { Button } from "@/components/ui/button";

const LABELS: Record<OfferAction, string> = {
  ACCEPT_AND_PAY: "Accept & pay",
  DECLINE: "Decline",
  WITHDRAW: "Withdraw offer",
  CONTINUE_PAYMENT: "Continue payment",
  CANCEL_PAYMENT: "Cancel payment",
  CANCEL_REMAINING: "Cancel remaining",
};

export function OfferActionBar({
  offer,
  pendingAction,
  onAction,
}: {
  offer: Pick<OfferDTO, "allowedActions">;
  pendingAction?: OfferAction;
  onAction?: (action: OfferAction) => void;
}) {
  if (offer.allowedActions.length === 0) {
    return <p className="text-sm text-muted-foreground">No actions available.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {offer.allowedActions.map((action) => {
        const primary = action === "ACCEPT_AND_PAY" || action === "CONTINUE_PAYMENT";
        const destructive = action === "DECLINE" || action === "CANCEL_PAYMENT" || action === "CANCEL_REMAINING" || action === "WITHDRAW";
        return (
          <Button
            key={action}
            type="button"
            variant={primary ? "primary" : destructive ? "outline" : "secondary"}
            loading={pendingAction === action}
            onClick={() => onAction?.(action)}
          >
            {LABELS[action]}
          </Button>
        );
      })}
    </div>
  );
}
