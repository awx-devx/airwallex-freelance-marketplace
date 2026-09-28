"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { InitResult } from "@airwallex/components-sdk";
import type { CardPaymentSessionDTO } from "@/contracts/payments";
import { Button } from "@/components/ui/button";
import { publicConfig } from "@/lib/config.public";

type PaymentsApi = NonNullable<InitResult["payments"]>;

const ELEMENT_ID = "airwallex-drop-in";

export function DropInCheckout({ session, offerId }: { session?: CardPaymentSessionDTO; offerId?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [payments, setPayments] = useState<PaymentsApi | null>(null);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    let unmount: (() => void) | undefined;

    void (async () => {
      try {
        const sdk = await import("@airwallex/components-sdk");
        const initialized = await sdk.init({
          env: publicConfig.airwallexEnv,
          enabledElements: ["payments"],
        });
        const api = initialized.payments;
        if (!api?.createElement) throw new Error("Airwallex Drop-in did not load.");
        if (cancelled) return;
        setPayments(api);
        // AIRWALLEX: mount the element before attaching listeners.
        // https://www.airwallex.com/docs/payments/payment-methods/card/drop-in-element
        const element = api.createElement("dropIn", {
          intent_id: session.intentId,
          client_secret: session.clientSecret,
          currency: session.amount.currency,
        });
        if (!element) throw new Error("Airwallex Drop-in did not load.");
        if (cancelled) return;
        element.mount(ELEMENT_ID);
        unmount = () => element.unmount();
        if (!cancelled) setError(null);
        element.on("success", () => router.push(`/offers/${offerId ?? session.offerId}/pay/return`));
        element.on("error", () => setError("The card form hit an error. You can try the hosted payment page."));
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "The card form hit an error.");
      }
    })();

    return () => {
      cancelled = true;
      unmount?.();
    };
  }, [offerId, router, session]);

  function openHostedPage() {
    if (!session || !payments) return;
    payments.redirectToCheckout({
      intent_id: session.intentId,
      client_secret: session.clientSecret,
      currency: session.amount.currency,
      successUrl: `${window.location.origin}/offers/${offerId ?? session.offerId}/pay/return`,
    });
  }

  if (!session) {
    return <p className="text-sm text-muted-foreground">Starting card payment…</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div id={ELEMENT_ID} />
      {error ? <p className="text-sm text-muted-foreground">{error}</p> : null}
      {error ? (
        <Button type="button" variant="outline" className="w-fit" onClick={openHostedPage}>
          Open hosted payment page
        </Button>
      ) : null}
    </div>
  );
}
