"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { DemoBanner, type DemoBannerVariant } from "@/components/layout/demo-banner";
import { TopBar } from "@/components/layout/top-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { useLogout, useMe } from "@/hooks/session";
import { useWallet } from "@/hooks/wallet";
import { publicConfig } from "@/lib/config.public";

function isPublic(pathname: string) {
  return pathname === "/login" || pathname === "/signup" || pathname.startsWith("/dev");
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const me = useMe();
  const user = me.data;
  const wallet = useWallet({ enabled: Boolean(user) });
  const logout = useLogout();
  const sessionReady = Boolean(user) && (user?.provisioning.step === "READY" || pathname === "/welcome");

  useEffect(() => {
    if (isPublic(pathname) || me.isLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.provisioning.step !== "READY" && pathname !== "/welcome") {
      router.replace("/welcome");
    }
  }, [me.isLoading, pathname, router, user]);

  const banner: DemoBannerVariant = user?.isGuest ? "guest" : publicConfig.apiMocks ? "mock" : "sandbox";

  return (
    <div className="flex min-h-svh flex-col bg-surface">
      <TopBar
        user={user}
        balance={wallet.data?.balances[0]}
        balanceLoading={wallet.isLoading}
        balanceError={wallet.isError}
        showUiKit={publicConfig.uiKitEnabled}
        onLogout={() => logout.mutate()}
      />
      <DemoBanner variant={banner} name={user?.isGuest ? user.name : undefined} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        {me.isLoading ? (
          <div className="flex flex-col gap-3" aria-label="Loading">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : sessionReady ? (
          children
        ) : null}
      </main>
    </div>
  );
}
