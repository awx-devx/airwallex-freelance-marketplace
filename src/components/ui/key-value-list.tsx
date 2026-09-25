import type { ReactNode } from "react";

export function KeyValueList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="divide-y divide-border rounded-lg border border-border bg-background">
      {items.map((item) => (
        <div key={item.label} className="flex items-baseline justify-between gap-4 px-3 py-2 text-sm">
          <dt className="text-muted-foreground">{item.label}</dt>
          <dd className="min-w-0 text-right font-medium tabular-nums">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
