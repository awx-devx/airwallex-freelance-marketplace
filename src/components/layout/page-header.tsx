import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function PageHeader({
  title,
  subtitle,
  backHref,
  backLabel = "Back",
  actions,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {backHref ? (
          <Link href={backHref} className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" />
            {backLabel}
          </Link>
        ) : null}
        <h1 className="font-serif text-3xl font-medium tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
