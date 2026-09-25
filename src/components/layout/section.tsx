import type { ReactNode } from "react";

export function Section({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count?: number;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-serif text-2xl font-medium tracking-tight">
          {title}
          {count !== undefined ? <span className="ml-2 text-base text-muted-foreground">{count}</span> : null}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
