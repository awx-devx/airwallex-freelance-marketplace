"use client";

import { useState, type ReactNode } from "react";
import type { UserSummaryDTO } from "@/contracts/users";
import { AccountCard } from "@/components/domain/account-card";
import { BalanceTable } from "@/components/domain/balance-table";
import { Money } from "@/components/domain/money";
import { TransactionList } from "@/components/domain/transaction-list";
import { UserPicker } from "@/components/domain/user-picker";
import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { MoneyInput } from "@/components/ui/money-input";
import { Skeleton } from "@/components/ui/skeleton";
import { useSendFunds, useWallet, useWalletTransactions, useWithdraw } from "@/hooks/wallet";
import { ApiError } from "@/lib/api/errors";

function AmountDialog({
  open,
  title,
  description,
  confirmLabel,
  pending,
  error,
  onOpenChange,
  onConfirm,
  extra,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  pending: boolean;
  error?: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (amount: string) => void;
  extra?: ReactNode;
}) {
  const [amount, setAmount] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setAmount("");
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {extra}
        <MoneyInput value={amount} onChange={setAmount} minimum={0.01} />
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="primary" loading={pending} disabled={amount.length === 0} onClick={() => onConfirm(amount)}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function WalletScreen() {
  const wallet = useWallet();
  const transactions = useWalletTransactions();
  const withdraw = useWithdraw();
  const send = useSendFunds();
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [recipient, setRecipient] = useState<UserSummaryDTO | undefined>();

  if (wallet.isLoading) {
    return (
      <div className="flex flex-col gap-3" aria-label="Loading wallet">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (wallet.isError || !wallet.data) {
    return (
      <ErrorState
        message={wallet.error instanceof ApiError ? wallet.error.message : "Couldn't load your wallet."}
        onRetry={() => wallet.refetch()}
      />
    );
  }

  const items = transactions.data?.pages.flatMap((page) => page.items) ?? [];
  const account = wallet.data;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Wallet"
        subtitle="Sandbox balance on your Airwallex connected account."
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => setWithdrawOpen(true)}>
              Withdraw
            </Button>
            <Button type="button" variant="primary" onClick={() => setSendOpen(true)}>
              Send
            </Button>
          </>
        }
      />
      <AccountCard account={account.account} />
      <BalanceTable balances={account.balances} />
      <section className="rounded-md border border-border bg-card p-5">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Held as buyer</dt>
            <dd className="mt-1">
              <Money value={account.escrow.heldAsBuyer} muted={account.escrow.heldAsBuyer.amountMinor === 0} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Incoming as seller</dt>
            <dd className="mt-1">
              <Money value={account.escrow.incomingAsSeller} muted={account.escrow.incomingAsSeller.amountMinor === 0} />
            </dd>
          </div>
        </dl>
      </section>
      <Section title="Transactions">
        {transactions.isLoading ? (
          <Skeleton className="h-24 w-full" aria-label="Loading transactions" />
        ) : transactions.isError ? (
          <ErrorState message="Couldn't load transactions." onRetry={() => transactions.refetch()} />
        ) : (
          <TransactionList
            items={items}
            hasMore={Boolean(transactions.hasNextPage)}
            loadingMore={transactions.isFetchingNextPage}
            onLoadMore={() => transactions.fetchNextPage()}
          />
        )}
      </Section>
      <AmountDialog
        open={withdrawOpen}
        title="Withdraw"
        description="Sandbox payout from your connected account. No real money moves."
        confirmLabel="Withdraw"
        pending={withdraw.isPending}
        error={withdraw.error instanceof ApiError ? withdraw.error.message : undefined}
        onOpenChange={setWithdrawOpen}
        onConfirm={(amount) => withdraw.mutate({ amount }, { onSuccess: () => setWithdrawOpen(false) })}
      />
      <AmountDialog
        open={sendOpen}
        title="Send"
        description="Move sandbox funds to another connected account."
        confirmLabel="Send"
        pending={send.isPending}
        error={send.error instanceof ApiError ? send.error.message : undefined}
        extra={<UserPicker value={recipient} onChange={setRecipient} />}
        onOpenChange={setSendOpen}
        onConfirm={(amount) => {
          if (!recipient) return;
          send.mutate({ recipientId: recipient.id, amount }, { onSuccess: () => setSendOpen(false) });
        }}
      />
    </div>
  );
}
