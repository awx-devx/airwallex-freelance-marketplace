"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ProvisioningChecklist } from "@/components/domain/provisioning-checklist";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe, useRunProvisioning } from "@/hooks/session";
import { ApiError } from "@/lib/api/errors";

// DEMO-ONLY: Provisioning runs in the request this screen fires, and the page polls until READY.
// PROD: A background job provisions the account. This screen only polls.
export function WelcomeScreen() {
  const router = useRouter();
  const me = useMe({ refetchInterval: 1500 });
  const run = useRunProvisioning();
  const started = useRef(false);
  const user = me.data;
  const step = user?.provisioning.step;

  useEffect(() => {
    if (!user || started.current) return;
    if (step === "READY" || step === "FAILED") return;
    started.current = true;
    run.mutate();
  }, [run, step, user]);

  if (me.isLoading) {
    return (
      <div className="flex flex-col gap-3" aria-label="Loading">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (me.isError) {
    return (
      <ErrorState
        message={me.error instanceof ApiError ? me.error.message : "Couldn't load your account."}
        onRetry={() => me.refetch()}
      />
    );
  }

  if (!user) return null;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl font-medium tracking-tight">Setting up your account</h1>
        <p className="mt-1 text-sm text-muted-foreground">This is a sandbox. The $5,000.00 credit is demo money.</p>
      </div>
      <ProvisioningChecklist
        provisioning={user.provisioning}
        onRetry={() => {
          started.current = true;
          run.mutate();
        }}
      />
      {user.airwallex.accountId ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
          <p className="truncate font-mono text-xs">{user.airwallex.accountId}</p>
          <CopyButton value={user.airwallex.accountId} />
        </div>
      ) : null}
      {step === "READY" ? (
        <Button type="button" variant="primary" onClick={() => router.push("/")}>
          Go to dashboard
        </Button>
      ) : null}
    </div>
  );
}
