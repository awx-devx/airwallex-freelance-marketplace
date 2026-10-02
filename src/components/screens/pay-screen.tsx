"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DropInCheckout } from "@/components/domain/drop-in-checkout";
import { MockCardForm } from "@/components/domain/mock-card-form";
import { Money } from "@/components/domain/money";
import { TestCardHint } from "@/components/domain/test-card-hint";
import { WalletChip } from "@/components/domain/wallet-chip";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOffer, usePayFromWallet, useStartCardPayment, useCancelPayment } from "@/hooks/offers";
import { usePublicConfig } from "@/hooks/session";
import { useWallet } from "@/hooks/wallet";
import { ApiError } from "@/lib/api/errors";
import { publicConfig } from "@/lib/config.public";
import { formatMoney } from "@/lib/money";

const DECLINE = "4012000300001003";

// DEMO-ONLY: A sandbox card number is stored on the mock payment, then the return page reconciles it.
// PROD: Drop-in confirms the PaymentIntent. The return page retrieves that intent on the server.
export function PayScreen({ id }: { id: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const offerQuery = useOffer(id);
  const config = usePublicConfig();
  const wallet = useWallet();
  const start = useStartCardPayment(id);
  const payWallet = usePayFromWallet(id);
  const cancel = useCancelPayment(id);
  const started = useRef(false);
  const offer = offerQuery.data;
  const method = search.get("method") === "wallet" ? "wallet" : "card";
  const mocks = config.data?.mocksEnabled ?? publicConfig.apiMocks;
  const walletEnabled = config.data?.walletRailEnabled ?? true;

  useEffect(() => {
    if (!offer) return;
    const allowed = offer.allowedActions.includes("ACCEPT_AND_PAY") || offer.allowedActions.includes("CONTINUE_PAYMENT");
    if (!allowed) router.replace(`/offers/${id}`);
  }, [id, offer, router]);

  useEffect(() => {
    if (method !== "card" || !offer || started.current) return;
    const allowed = offer.allowedActions.includes("ACCEPT_AND_PAY") || offer.allowedActions.includes("CONTINUE_PAYMENT");
    if (!allowed) return;
    started.current = true;
    start.mutate(undefined, {
      onError: () => {
        started.current = false;
      },
    });
  }, [method, offer, start]);

  function selectMethod(value: string) {
    const params = new URLSearchParams(search.toString());
    params.set("method", value);
    router.replace(`/offers/${id}/pay?${params.toString()}`, { scroll: false });
  }

  async function finishCard(cardNumber: string) {
    if (mocks) {
      const mock = await import("@/lib/api/mock");
      mock.submitMockCard(id, cardNumber);
    }
    router.push(`/offers/${id}/pay/return`);
  }

  if (offerQuery.isLoading) {
    return (
      <div className="flex flex-col gap-3" aria-label="Loading payment">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (offerQuery.isError || !offer) {
    return (
      <ErrorState
        message={offerQuery.error instanceof ApiError ? offerQuery.error.message : "Couldn't load this payment."}
        onRetry={() => offerQuery.refetch()}
      />
    );
  }

  const available = wallet.data?.balances[0]?.available.amountMinor ?? 0;
  const shortfall = available < offer.total.amountMinor;
  const amountLabel = formatMoney(offer.total.amountMinor, offer.total.currency);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pay"
        subtitle="Sandbox demo. No real money moves."
        backHref={`/offers/${id}`}
        backLabel="Offer"
        actions={
          offer.allowedActions.includes("CANCEL_PAYMENT") ? (
            <Button
              type="button"
              variant="outline"
              loading={cancel.isPending}
              onClick={() => cancel.mutate(undefined, { onSuccess: () => router.push(`/offers/${id}`) })}
            >
              Cancel payment
            </Button>
          ) : null
        }
      />
      <section className="rounded-md border border-border bg-card p-5">
        <p className="text-xs text-muted-foreground">Platform, awaiting release for {offer.seller.name}</p>
        <h2 className="mt-1 font-serif text-2xl font-medium tracking-tight">{offer.title}</h2>
        <ul className="mt-4 flex flex-col">
          {offer.milestones.map((milestone) => (
            <li key={milestone.id} className="flex items-center justify-between gap-3 border-b border-border py-2 text-sm">
              <span>{milestone.title}</span>
              <Money value={milestone.amount} className="text-base" />
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Total</span>
          <Money value={offer.total} />
        </div>
      </section>
      <p className="max-w-xl text-sm text-muted-foreground">
        Each milestone stays unreleased until you approve it.
      </p>
      <Tabs value={walletEnabled ? method : "card"} onValueChange={selectMethod}>
        <TabsList>
          <TabsTrigger value="card">Card</TabsTrigger>
          {walletEnabled ? <TabsTrigger value="wallet">Wallet</TabsTrigger> : null}
        </TabsList>
        <TabsContent value="card" className="flex flex-col gap-4 pt-4">
          {start.isError ? (
            <ErrorState
              message={start.error instanceof ApiError ? start.error.message : "Couldn't start the card payment."}
              onRetry={() => {
                started.current = true;
                start.mutate(undefined, { onError: () => { started.current = false; } });
              }}
            />
          ) : mocks ? (
            <MockCardForm
              amount={offer.total}
              onSuccess={(cardNumber) => void finishCard(cardNumber)}
              onDecline={(cardNumber) => {
                if (cardNumber === DECLINE) void finishCard(cardNumber);
              }}
            />
          ) : (
            <DropInCheckout session={start.data} offerId={id} />
          )}
          {config.data ? <TestCardHint cards={config.data.testCards} /> : null}
        </TabsContent>
        {walletEnabled ? (
          <TabsContent value="wallet" className="flex flex-col items-start gap-4 pt-4">
            <WalletChip balance={wallet.data?.balances[0]} loading={wallet.isLoading} error={wallet.isError} />
            <Button type="button" variant="primary" disabled={shortfall || wallet.isLoading} loading={payWallet.isPending} onClick={() => payWallet.mutate(undefined, { onSuccess: () => router.push(`/offers/${id}/pay/return`) })}>
              Pay {amountLabel} from wallet
            </Button>
            {shortfall && !wallet.isLoading ? <p className="text-sm text-muted-foreground">Your wallet doesn&apos;t have enough to pay this offer.</p> : null}
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
