"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { SignupInputSchema, type SignupInput } from "@/contracts/users";
import { applyApiFieldErrors } from "@/components/screens/form-errors";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { useSignup } from "@/hooks/session";

export function SignupScreen() {
  const signup = useSignup();
  const form = useForm<SignupInput>({
    resolver: zodResolver(SignupInputSchema),
    defaultValues: { name: "", email: "", password: "", headline: "" },
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-serif text-3xl font-medium tracking-tight">Create an account</h1>
        <p className="mt-1 text-sm text-muted-foreground">We&apos;ll create a sandbox Airwallex account for you. No email verification.</p>
      </div>
      <form
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit((values) =>
          signup.mutate(
            { ...values, headline: values.headline || undefined },
            { onError: (error) => applyApiFieldErrors(form, error) },
          ),
        )}
      >
        <FormField label="Name" htmlFor="name" required error={form.formState.errors.name?.message}>
          <Input id="name" autoComplete="name" aria-invalid={Boolean(form.formState.errors.name)} {...form.register("name")} />
        </FormField>
        <FormField label="Email" htmlFor="email" required error={form.formState.errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" aria-invalid={Boolean(form.formState.errors.email)} {...form.register("email")} />
        </FormField>
        <FormField label="Password" htmlFor="password" required error={form.formState.errors.password?.message}>
          <Input id="password" type="password" autoComplete="new-password" aria-invalid={Boolean(form.formState.errors.password)} {...form.register("password")} />
        </FormField>
        <FormField label="Headline" htmlFor="headline" hint="Optional. Shown on your offers." error={form.formState.errors.headline?.message}>
          <Input id="headline" aria-invalid={Boolean(form.formState.errors.headline)} {...form.register("headline")} />
        </FormField>
        <Button type="submit" variant="primary" loading={signup.isPending}>
          Create account
        </Button>
      </form>
      <p className="text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="text-foreground underline underline-offset-4">
          Log in
        </Link>
      </p>
    </div>
  );
}
