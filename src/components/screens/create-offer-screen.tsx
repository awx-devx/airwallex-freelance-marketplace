"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { FormProvider, useForm, useWatch, type FieldErrors } from "react-hook-form";
import { CreateOfferInputSchema, type CreateOfferInput } from "@/contracts/offers";
import type { UserSummaryDTO } from "@/contracts/users";
import { FeeBreakdown } from "@/components/domain/fee-breakdown";
import { MilestoneEditor } from "@/components/domain/milestone-editor";
import { Money } from "@/components/domain/money";
import { UserPicker } from "@/components/domain/user-picker";
import { PageHeader } from "@/components/layout/page-header";
import { applyApiFieldErrors } from "@/components/screens/form-errors";
import { ApiError } from "@/lib/api/errors";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useCreateOffer } from "@/hooks/offers";
import { usePublicConfig } from "@/hooks/session";
import { fromAwxAmount } from "@/lib/money";
import { breakdown } from "@/services/fees";

const MAJOR_AMOUNT = /^\d+(\.\d{1,2})?$/;

function milestoneFieldErrors(errors: FieldErrors<CreateOfferInput>) {
  const out: Record<string, string> = {};
  const rows = errors.milestones;
  if (Array.isArray(rows)) {
    rows.forEach((row, index) => {
      if (!row) return;
      for (const key of ["title", "amount", "description", "dueDate"] as const) {
        const message = row[key]?.message;
        if (typeof message === "string") out[`milestones.${index}.${key}`] = message;
      }
    });
  }
  return out;
}

function liveFees(rows: CreateOfferInput["milestones"], percents: { platformFeePercent: number; processingReservePercent: number }, currency: string) {
  let totalMinor = 0;
  let sellerMinor = 0;
  let revenueMinor = 0;
  let reserveMinor = 0;
  let feeMinor = 0;
  for (const row of rows) {
    if (!MAJOR_AMOUNT.test(row.amount)) continue;
    const amountMinor = fromAwxAmount(row.amount, currency);
    const parts = breakdown(amountMinor, percents);
    totalMinor += amountMinor;
    sellerMinor += parts.sellerMinor;
    revenueMinor += parts.revenueMinor;
    reserveMinor += parts.reserveMinor;
    feeMinor += parts.feeMinor;
  }
  const money = (amountMinor: number) => ({ amountMinor, currency });
  return {
    total: money(totalMinor),
    seller: money(sellerMinor),
    split: {
      seller: money(sellerMinor),
      revenue: money(revenueMinor),
      reserve: money(reserveMinor),
      fee: money(feeMinor),
    },
  };
}

export function CreateOfferScreen() {
  const config = usePublicConfig();
  const create = useCreateOffer();
  const [buyer, setBuyer] = useState<UserSummaryDTO | undefined>();
  const form = useForm<CreateOfferInput>({
    resolver: (values, context, options) =>
      zodResolver(CreateOfferInputSchema)(
        {
          ...values,
          milestones: values.milestones.map((milestone) => ({
            ...milestone,
            description: milestone.description || undefined,
            dueDate: milestone.dueDate || undefined,
          })),
        },
        context,
        options,
      ),
    defaultValues: {
      buyerId: "",
      title: "",
      description: "",
      milestones: [{ title: "", amount: "" }],
    },
  });
  const milestones = useWatch({ control: form.control, name: "milestones" });
  const fees = config.data ? liveFees(milestones, config.data, config.data.currency) : null;
  const listError = form.formState.errors.milestones;
  const listMessage = listError && "message" in listError && typeof listError.message === "string" ? listError.message : undefined;

  return (
    <FormProvider {...form}>
      <form
        className="flex flex-col gap-8"
        onSubmit={form.handleSubmit((values) =>
          create.mutate(
            {
              ...values,
              milestones: values.milestones.map((milestone) => ({
                ...milestone,
                description: milestone.description || undefined,
                dueDate: milestone.dueDate || undefined,
              })),
            },
            { onError: (error) => applyApiFieldErrors(form, error) },
          ),
        )}
      >
        <PageHeader title="New offer" subtitle="The buyer pays the total up front. Each milestone stays held until they approve it." backHref="/" backLabel="Home" />
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="flex flex-col gap-4">
            <FormField label="Buyer" required error={form.formState.errors.buyerId?.message}>
              <UserPicker
                value={buyer}
                onChange={(user) => {
                  setBuyer(user);
                  form.setValue("buyerId", user.id, { shouldValidate: true });
                }}
              />
            </FormField>
            <FormField label="Title" htmlFor="title" required error={form.formState.errors.title?.message}>
              <Input id="title" aria-invalid={Boolean(form.formState.errors.title)} {...form.register("title")} />
            </FormField>
            <FormField label="Description" htmlFor="description" error={form.formState.errors.description?.message}>
              <Textarea id="description" aria-invalid={Boolean(form.formState.errors.description)} {...form.register("description")} />
            </FormField>
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Milestones</p>
              <MilestoneEditor connected max={config.data?.maxMilestones ?? 10} fieldErrors={milestoneFieldErrors(form.formState.errors)} />
              {listMessage ? <p className="text-sm text-danger">{listMessage}</p> : null}
            </div>
            {create.error instanceof ApiError && !create.error.fieldErrors ? (
              <p className="text-sm text-danger" role="alert">
                {create.error.message}
              </p>
            ) : null}
            <Button type="submit" variant="primary" className="w-fit" loading={create.isPending}>
              Send offer
            </Button>
          </div>
          <aside className="flex flex-col gap-3 rounded-md border border-border bg-card p-5 lg:sticky lg:top-28">
            <div>
              <p className="text-xs text-muted-foreground">Buyer pays</p>
              <Money value={fees?.total ?? { amountMinor: 0, currency: config.data?.currency ?? "USD" }} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">You&apos;ll receive</p>
              <Money value={fees?.seller ?? { amountMinor: 0, currency: config.data?.currency ?? "USD" }} />
            </div>
            {fees ? <FeeBreakdown variant="card" value={fees.split} /> : null}
          </aside>
        </div>
      </form>
    </FormProvider>
  );
}
