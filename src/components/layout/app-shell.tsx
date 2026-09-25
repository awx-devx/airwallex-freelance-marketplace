"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { DemoBanner, type DemoBannerVariant } from "@/components/layout/demo-banner";
import { TopBar } from "@/components/layout/top-bar";
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
  const wallet = useWallet();
  const logout = useLogout();
  const user = me.data;

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

  const banner: DemoBannerVariant = publicConfig.apiMocks ? "mock" : user?.isGuest ? "guest" : "sandbox";

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
      <DemoBanner variant={banner} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
