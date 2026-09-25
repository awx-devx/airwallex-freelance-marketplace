"use client";

import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

export type DemoBannerVariant = "sandbox" | "guest" | "mock";

const COPY: Record<DemoBannerVariant, string> = {
  sandbox: "Sandbox — payments use test card 4035 5010 0000 0008. No real money moves.",
  guest: "You're exploring as a guest (shared demo account).",
  mock: "Mock data — no backend",
};

function subscribe(onStoreChange: () => void) {
  window.addEventListener("awx-storage", onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener("awx-storage", onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

export function DemoBanner({
  variant,
  name,
  dismissible = true,
}: {
  variant: DemoBannerVariant;
  name?: string;
  dismissible?: boolean;
}) {
  const key = `awx-escrow.banner.${variant}`;
  const copy = variant === "guest" && name ? `You're exploring as ${name} (shared demo account).` : COPY[variant];
  const dismissed = useSyncExternalStore(
    subscribe,
    () => (dismissible ? window.localStorage.getItem(key) === "1" : false),
    () => false,
  );

  if (dismissed) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted px-4 py-2 text-sm sm:px-6">
      <p className="min-w-0">{copy}</p>
      {dismissible ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            window.localStorage.setItem(key, "1");
            window.dispatchEvent(new Event("awx-storage"));
          }}
        >
          Dismiss
        </Button>
      ) : null}
    </div>
  );
}
