"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { BalanceDTO } from "@/contracts/wallet";
import type { UserSummaryDTO } from "@/contracts/users";
import { UserChip } from "@/components/domain/user-chip";
import { WalletChip } from "@/components/domain/wallet-chip";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function TopBar({
  user,
  balance,
  balanceLoading = false,
  balanceError = false,
  showUiKit = false,
  onLogout,
}: {
  user?: UserSummaryDTO | null;
  balance?: BalanceDTO;
  balanceLoading?: boolean;
  balanceError?: boolean;
  showUiKit?: boolean;
  onLogout?: () => void;
}) {
  const router = useRouter();

  return (
    <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border bg-background px-4 py-3 sm:px-6">
      <Link href="/" className="font-serif text-xl font-medium tracking-tight">
        Escrow
      </Link>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link href="/wallet" className="rounded-md px-2 py-1 hover:bg-muted" aria-label="Wallet">
          <WalletChip balance={balance} loading={balanceLoading} error={balanceError} />
        </Link>
        <Button type="button" variant="primary" size="sm" onClick={() => router.push("/offers/new")}>
          New offer
        </Button>
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" className="h-auto px-2">
                <UserChip user={user} subtitle="" className="max-w-36" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => router.push("/wallet")}>Wallet</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => router.push("/platform")}>Platform</DropdownMenuItem>
              {showUiKit ? <DropdownMenuItem onSelect={() => router.push("/dev/ui-kit")}>UI kit</DropdownMenuItem> : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => onLogout?.()}>Log out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </header>
  );
}
