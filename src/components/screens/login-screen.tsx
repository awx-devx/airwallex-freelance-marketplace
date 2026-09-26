"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { LoginInputSchema, type LoginInput } from "@/contracts/users";
import { UserChip } from "@/components/domain/user-chip";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useDemoAccounts, useGuestLogin, useLogin } from "@/hooks/session";
import { ApiError } from "@/lib/api/errors";

export function LoginScreen() {
  const accounts = useDemoAccounts();
  const login = useLogin();
  const guest = useGuestLogin();
  const form = useForm<LoginInput>({ resolver: zodResolver(LoginInputSchema), defaultValues: { email: "", password: "" } });
  const credentialsError = login.error instanceof ApiError && login.error.code === "INVALID_CREDENTIALS" ? login.error.message : undefined;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-serif text-3xl font-medium tracking-tight">Log in</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sandbox demo. Payments use test cards, and no real money moves.</p>
      </div>

      <form
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit((values) => login.mutate(values))}
      >
        <FormField label="Email" htmlFor="email" required error={form.formState.errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" aria-invalid={Boolean(form.formState.errors.email)} {...form.register("email")} />
        </FormField>
        <FormField label="Password" htmlFor="password" required error={form.formState.errors.password?.message}>
          <Input id="password" type="password" autoComplete="current-password" aria-invalid={Boolean(form.formState.errors.password)} {...form.register("password")} />
        </FormField>
        {credentialsError ? (
          <p className="text-sm text-danger" role="alert">
            {credentialsError}
          </p>
        ) : null}
        <Button type="submit" variant="primary" loading={login.isPending}>
          Log in
        </Button>
      </form>

      <Button type="button" variant="secondary" size="lg" loading={guest.isPending} onClick={() => guest.mutate()}>
        Continue as guest
      </Button>

      <p className="text-sm text-muted-foreground">
        New here?{" "}
        <Link href="/signup" className="text-foreground underline underline-offset-4">
          Create an account
        </Link>
      </p>

      <section className="flex flex-col gap-3">
        <h2 className="font-serif text-2xl font-medium tracking-tight">Demo accounts</h2>
        <p className="text-sm text-muted-foreground">
          Password <span className="font-mono text-foreground">demo1234</span>
        </p>
        {accounts.isLoading ? (
          <div className="flex flex-col gap-2" aria-label="Loading demo accounts">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : accounts.isError ? (
          <ErrorState message="Couldn't load demo accounts." onRetry={() => accounts.refetch()} />
        ) : (
          <ul className="flex flex-col gap-2">
            {(accounts.data ?? []).map((account) => (
              <li key={account.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                <UserChip user={account} subtitle={account.role} />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  loading={login.isPending && login.variables?.email === account.email}
                  onClick={() => login.mutate({ email: account.email, password: "demo1234" })}
                >
                  Log in as
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
