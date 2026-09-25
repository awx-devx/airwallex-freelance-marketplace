import type { MoneyDTO } from "@/contracts/common";
import { formatMoney } from "@/lib/money";
import { cn } from "cn";

export function Money({
  value,
  signed = false,
  muted = false,
  size = "md",
  className,
}: {
  value: MoneyDTO;
  signed?: boolean;
  muted?: boolean;
  size?: "md" | "lg";
  className?: string;
}) {
  const formatted = formatMoney(value.amountMinor, value.currency);
  const text = signed && value.amountMinor > 0 ? `+${formatted}` : formatted;

  return (
    <span
      className={cn(
        "font-serif tabular-nums tracking-tight",
        size === "lg" ? "text-3xl" : "text-xl",
        muted || value.amountMinor === 0 ? "text-muted-foreground" : "text-foreground",
        className,
      )}
    >
      {text}
    </span>
  );
}
