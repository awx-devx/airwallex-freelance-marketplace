"use client";

import { Input } from "@/components/ui/input";

export const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;
export const MIN_MILESTONE_MAJOR = 10;

export function formatMoneyPreview(value: string): string | null {
  if (!MONEY_PATTERN.test(value)) return null;
  const [whole = "0", fraction = ""] = value.split(".");
  const dollars = Number(whole).toLocaleString("en-US");
  return `$${dollars}.${fraction.padEnd(2, "0")}`;
}

export function moneyInputError(value: string, minimum = MIN_MILESTONE_MAJOR): string | null {
  if (value === "") return null;
  if (!MONEY_PATTERN.test(value)) return "Enter a dollar amount with up to 2 decimal places.";
  if (Number(value) < minimum) return `Minimum is $${minimum.toFixed(2)}.`;
  return null;
}

export function MoneyInput({
  value,
  onChange,
  minimum = MIN_MILESTONE_MAJOR,
  id,
  disabled,
  name,
}: {
  value: string;
  onChange: (value: string) => void;
  minimum?: number;
  id?: string;
  disabled?: boolean;
  name?: string;
}) {
  const error = moneyInputError(value, minimum);
  const preview = formatMoneyPreview(value);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">
          $
        </span>
        <Input
          id={id}
          name={name}
          inputMode="decimal"
          disabled={disabled}
          value={value}
          aria-invalid={error ? true : undefined}
          className="pl-6 tabular-nums"
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : preview ? (
        <p className="money text-3xl text-foreground">{preview}</p>
      ) : null}
    </div>
  );
}
