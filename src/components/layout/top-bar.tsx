"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import type { BalanceDTO } from "@/contracts/wallet";
import type { UserSummaryDTO } from "@/contracts/users";
import { UserChip } from "@/components/domain/user-chip";
import { WalletChip } from "@/components/domain/wallet-chip";
import { LogoMark } from "@/components/layout/logo-mark";
import { HeaderCredit } from "@/components/layout/powered-by";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Dialog, DialogClose, DialogOverlay, DialogPortal, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatMoney } from "@/lib/money";
import { cn } from "cn";

function walletLabel(balance?: BalanceDTO) {
  if (!balance) return "Wallet";
  return `Wallet, ${formatMoney(balance.available.amountMinor, balance.available.currency)} available`;
}

export function TopBar({
  user,
  balance,
  balanceLoading = false,
  balanceError = false,
  pinned = true,
  onLogout,
}: {
  user?: UserSummaryDTO | null;
  balance?: BalanceDTO;
  balanceLoading?: boolean;
  balanceError?: boolean;
  pinned?: boolean;
  onLogout?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const label = walletLabel(balance);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  function go(href: string) {
    setMenuOpen(false);
    router.push(href);
  }

  return (
    <header className={cn("relative z-30 border-b border-border bg-background", pinned && "sticky top-0")}>
      <div className="flex min-h-14 items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" aria-label="Freelance escrow" className="inline-flex items-center text-foreground max-md:min-h-11">
          <LogoMark />
        </Link>
        <div className="hidden items-center gap-2 md:flex">
          <Link href="/wallet" className="rounded-md px-2 py-1 hover:bg-muted" aria-label={label}>
            <WalletChip balance={balance} loading={balanceLoading} error={balanceError} />
          </Link>
          <Button type="button" variant="primary" size="sm" onClick={() => router.push("/offers/new")}>
            New offer
          </Button>
          <ThemeToggle />
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" className="h-auto px-2" aria-label="Account">
                  <UserChip user={user} subtitle="" className="max-w-36" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => router.push("/wallet")}>Wallet</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => router.push("/platform")}>Platform</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => onLogout?.()}>Log out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
        <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="md:hidden" aria-label="Menu">
              <Menu />
            </Button>
          </DialogTrigger>
          <DialogPortal>
            <DialogOverlay />
            <DialogPrimitive.Content
              data-slot="nav-menu"
              className="fixed inset-y-0 right-0 z-50 flex h-dvh w-72 max-w-[calc(100%-3rem)] flex-col border-l border-border bg-background p-4 pb-16 outline-none duration-200 data-open:animate-in data-open:slide-in-from-right data-closed:animate-out data-closed:slide-out-to-right"
            >
              <div className="flex items-start justify-between gap-3">
                {user ? <UserChip user={user} size="md" className="min-w-0" /> : <DialogTitle>Menu</DialogTitle>}
                <DialogClose asChild>
                  <Button type="button" variant="ghost" size="icon" className="shrink-0" aria-label="Close menu">
                    <X />
                  </Button>
                </DialogClose>
              </div>
              {user ? <DialogTitle className="sr-only">Menu</DialogTitle> : null}
              <nav className="mt-6 flex flex-col gap-1">
                <Button type="button" variant="primary" onClick={() => go("/offers/new")}>
                  New offer
                </Button>
                <MenuLink onClick={() => go("/wallet")}>
                  <span>Wallet</span>
                  <WalletChip balance={balance} loading={balanceLoading} error={balanceError} />
                </MenuLink>
                <MenuLink onClick={() => go("/platform")}>Platform</MenuLink>
              </nav>
              <div className="mt-auto flex flex-col gap-4 pt-6">
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-muted-foreground">Theme</p>
                  <ThemeToggle />
                </div>
                {user ? (
                  <Button type="button" variant="outline" onClick={() => { setMenuOpen(false); onLogout?.(); }}>
                    Log out
                  </Button>
                ) : null}
              </div>
            </DialogPrimitive.Content>
          </DialogPortal>
        </Dialog>
      </div>
      <HeaderCredit />
    </header>
  );
}

function MenuLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-11 items-center justify-between gap-3 rounded-md px-3 text-left text-sm hover:bg-muted",
        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
      )}
    >
      {children}
    </button>
  );
}
