import { cn } from "cn";

export function PoweredBy({ className }: { className?: string }) {
  return (
    <a
      href="https://www.airwallex.com"
      target="_blank"
      rel="noreferrer"
      aria-label="Powered by Airwallex"
      className={cn(
        "inline-flex items-center gap-1.5 border border-border bg-background px-2.5 py-1",
        className,
      )}
    >
      <span className="text-[10px] font-medium tracking-[0.16em] whitespace-nowrap text-muted-foreground uppercase">
        Powered by
      </span>
      <img src="/airwallex-light.png" alt="" className="h-4 w-auto dark:hidden" />
      <img src="/airwallex-dark.png" alt="" className="hidden h-4 w-auto dark:block" />
    </a>
  );
}

/** Square tab hung entirely under the bar, covering the bottom rule so the border opens into it. */
export function HeaderCredit() {
  return <PoweredBy className="absolute top-full left-1/2 z-10 -translate-x-1/2 -translate-y-px border-t-0" />;
}
