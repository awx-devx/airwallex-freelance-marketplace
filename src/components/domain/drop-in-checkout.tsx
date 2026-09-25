import type { CardPaymentSessionDTO } from "@/contracts/payments";

export function DropInCheckout({ session }: { session?: CardPaymentSessionDTO }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-background p-5 text-sm text-muted-foreground">
      <p className="font-medium text-foreground">Airwallex Drop-in</p>
      <p className="mt-1">
        {session
          ? `Ready for PaymentIntent ${session.intentId}. This placeholder is replaced by the Airwallex component when mocks are off.`
          : "This checkout needs a real PaymentIntent. With mocks on, the pay page uses the sandbox card form instead."}
      </p>
    </div>
  );
}
