"use client";

import { useState } from "react";
import type { MoneyDTO } from "@/contracts/common";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SUCCESS = "4035501000000008";
const DECLINE = "4012000300001003";

type Phase = "idle" | "submitting" | "declined" | "success";

// DEMO-ONLY: Stand-in for the Airwallex card Drop-in. 4035501000000008 succeeds; 4012000300001003 declines.
// PROD: PayScreen renders DropInCheckout with @airwallex/components-sdk.
export function MockCardForm({
  amount,
  phase: forcedPhase,
  onSuccess,
  onDecline,
}: {
  amount: MoneyDTO;
  phase?: Phase;
  onSuccess?: (cardNumber: string) => void;
  onDecline?: (cardNumber: string) => void;
}) {
  const [number, setNumber] = useState("");
  const [phase, setPhase] = useState<Phase>(forcedPhase ?? "idle");
  const shown = forcedPhase ?? phase;

  function pay() {
    if (forcedPhase) return;
    setPhase("submitting");
    const digits = number.replace(/\s/g, "");
    window.setTimeout(() => {
      if (digits === SUCCESS) {
        setPhase("success");
        onSuccess?.(digits);
        return;
      }
      setPhase("declined");
      onDecline?.(digits);
    }, 400);
  }

  if (shown === "success") {
    return <p className="text-sm">Payment received. {formatMoney(amount.amountMinor, amount.currency)} will be held in escrow.</p>;
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-md border border-border bg-card p-5"
      onSubmit={(event) => {
        event.preventDefault();
        pay();
      }}
    >
      <p className="text-sm text-muted-foreground">Sandbox card. No real charge.</p>
      <Input
        inputMode="numeric"
        autoComplete="off"
        placeholder="Card number"
        aria-label="Card number"
        value={forcedPhase === "declined" ? "4012 0003 0000 1003" : number}
        aria-invalid={shown === "declined"}
        onChange={(event) => setNumber(event.target.value)}
      />
      {shown === "declined" ? <p className="text-sm text-danger">{number.replace(/\s/g, "") === DECLINE || forcedPhase === "declined" ? "The card was declined." : "Use a sandbox test card."}</p> : null}
      <Button type="submit" variant="primary" loading={shown === "submitting"}>
        Pay {formatMoney(amount.amountMinor, amount.currency)}
      </Button>
    </form>
  );
}
