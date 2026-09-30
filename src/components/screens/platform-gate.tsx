"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { DemoAdminUnlockSchema, type DemoAdminUnlockInput } from "@/contracts/platform";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { useUnlockPlatform } from "@/hooks/platform";
import { ApiError } from "@/lib/api/errors";

export function PlatformGate() {
  const unlock = useUnlockPlatform();
  const form = useForm<DemoAdminUnlockInput>({
    resolver: zodResolver(DemoAdminUnlockSchema),
    defaultValues: { key: "" },
  });
  const rejected = unlock.error instanceof ApiError && unlock.error.code === "FORBIDDEN" ? unlock.error.message : undefined;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-8">
      <PageHeader
        title="Platform"
        subtitle="This sandbox view is locked. Enter the demo admin key to see platform and Revenue balances."
      />
      <form className="flex flex-col gap-4" onSubmit={form.handleSubmit((values) => unlock.mutate(values))}>
        <FormField label="Admin key" htmlFor="admin-key" required error={form.formState.errors.key?.message ?? rejected}>
          <Input
            id="admin-key"
            type="password"
            autoComplete="current-password"
            aria-invalid={Boolean(form.formState.errors.key || rejected)}
            {...form.register("key")}
          />
        </FormField>
        <Button type="submit" variant="primary" loading={unlock.isPending}>
          Unlock platform
        </Button>
      </form>
    </div>
  );
}
