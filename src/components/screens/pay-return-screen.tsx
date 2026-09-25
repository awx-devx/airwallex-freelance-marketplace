"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Spinner } from "@/components/ui/spinner";
import { useOffer, useOfferSync, useReconcilePayment } from "@/hooks/offers";
import { ApiError } from "@/lib/api/errors";
import { formatMoney } from "@/lib/money";

export function PayReturnScreen({ id }: { id: string }) {
  const router = useRouter();
  const reconcile = useReconcilePayment(id);
  const offerQuery = useOffer(id);
  const offer = offerQuery.data;
  useOfferSync(id, offer);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    reconcile.mutate();
  }, [reconcile]);

  if (reconcile.isError && !offer) {
    return (
      <ErrorState
        message={reconcile.error instanceof ApiError ? reconcile.error.message : "Couldn't confirm the payment."}
        onRetry={() => reconcile.mutate()}
      />
    );
  }

  const waiting = !offer || offer.status === "AWAITING_PAYMENT" || offer.isPending;
  if (waiting && offer?.status !== "ACTIVE") {
    return (
      <div className="flex items-center gap-3 py-10" role="status">
        <Spinner />
        <p className="text-sm">Confirming your payment…</p>
      </div>
    );
  }

  if (offer?.status === "ACTIVE" || offer?.payment?.status === "SUCCEEDED") {
    return (
      <div className="flex max-w-lg flex-col items-start gap-4 py-6">
        <h1 className="font-serif text-3xl font-medium tracking-tight">Payment received</h1>
        <p className="text-sm text-muted-foreground">
          Payment received, {formatMoney(offer.total.amountMinor, offer.total.currency)} held in escrow.
        </p>
        <Button type="button" variant="primary" onClick={() => router.push(`/offers/${id}`)}>
          View contract
        </Button>
      </div>
    );
  }

  return (
    <div className="flex max-w-lg flex-col items-start gap-4 py-6">
      <h1 className="font-serif text-3xl font-medium tracking-tight">Payment not completed</h1>
      <p className="text-sm text-muted-foreground">The charge didn&apos;t go through. You can try another sandbox card, or pay from your wallet.</p>
      <Button type="button" variant="primary" onClick={() => router.push(`/offers/${id}/pay`)}>
        Try again
      </Button>
    </div>
  );
}
