"use client";

import { useState } from "react";
import type { MoneyDTO } from "@/contracts/common";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function ReviewActions({
  amount,
  approving = false,
  onApprove,
  onRequestChanges,
}: {
  amount: MoneyDTO;
  approving?: boolean;
  onApprove?: () => void;
  onRequestChanges?: (comment: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="primary" loading={approving} onClick={() => onApprove?.()}>
        Approve & release {formatMoney(amount.amountMinor, amount.currency)}
      </Button>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        Request changes
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Request changes"
        description="The seller will see your comment and can submit again."
        confirmLabel="Request changes"
        requireReason
        onConfirm={(comment) => {
          onRequestChanges?.(comment);
          setOpen(false);
        }}
      />
    </div>
  );
}
