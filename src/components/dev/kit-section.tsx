import type { ReactNode } from "react";
import { cn } from "cn";

export function KitSection({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-b border-border py-8">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{note}</p>
      <div className="mt-5 grid grid-cols-1 gap-4 @min-[720px]:grid-cols-2">{children}</div>
    </section>
  );
}

export function Variant({
  caption,
  children,
  className,
}: {
  caption: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <figure className={cn("flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-background p-4", className)}>
      <div className="min-w-0">{children}</div>
      <figcaption className="text-xs text-muted-foreground">{caption}</figcaption>
    </figure>
  );
}
