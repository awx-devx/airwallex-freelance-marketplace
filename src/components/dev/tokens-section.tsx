import { KitSection, Variant } from "@/components/dev/kit-section";

const colors = [
  ["Background", "#FFFFFF", "bg-background"],
  ["Surface", "#F8F9FB", "bg-surface"],
  ["Foreground", "#0F172A", "bg-foreground"],
  ["Muted", "#64748B", "bg-muted-foreground"],
  ["Border", "#E2E8F0", "bg-border"],
  ["Primary", "#612FFF", "bg-primary"],
  ["Success", "#16A34A", "bg-success"],
  ["Warning", "#D97706", "bg-warning"],
  ["Danger", "#DC2626", "bg-danger"],
  ["Info", "#2563EB", "bg-info"],
] as const;

const typeScale = [
  ["text-xs", "12px", "text-xs"],
  ["text-sm", "14px · default UI", "text-sm"],
  ["text-base", "16px", "text-base"],
  ["text-lg", "18px", "text-lg"],
  ["text-xl", "20px", "text-xl"],
  ["text-2xl", "24px · page titles", "text-2xl font-semibold"],
] as const;

export function TokensSection() {
  return (
    <KitSection id="tokens" title="Tokens" note="One light theme. Violet accent, slate text, 10px radius.">
      <Variant caption="Color" className="@min-[720px]:col-span-2">
        <div className="grid grid-cols-2 gap-3 @min-[520px]:grid-cols-5">
          {colors.map(([name, hex, swatch]) => (
            <div key={name} className="min-w-0">
              <div className={`h-10 rounded-md border border-border ${swatch}`} />
              <p className="mt-1 text-xs font-medium">{name}</p>
              <p className="font-mono text-xs text-muted-foreground">{hex}</p>
            </div>
          ))}
        </div>
      </Variant>
      <Variant caption="Type scale" className="@min-[720px]:col-span-2">
        <div className="flex flex-col gap-2">
          {typeScale.map(([name, detail, className]) => (
            <p key={name} className={className}>
              {name} <span className="text-sm font-normal text-muted-foreground">{detail}</span>
            </p>
          ))}
          <p className="text-sm">
            Weights: <span className="font-normal">400 body</span>, <span className="font-medium">500 labels</span>,{" "}
            <span className="font-semibold">600 headings</span>
          </p>
        </div>
      </Variant>
      <Variant caption="Radius · 0.625rem">
        <div className="flex items-center gap-3">
          <div className="size-12 rounded-md border border-border bg-muted" />
          <div className="size-12 rounded-lg border border-border bg-muted" />
          <span className="text-xs text-muted-foreground">rounded-md / rounded-lg</span>
        </div>
      </Variant>
      <Variant caption="Spacing · 4px scale">
        <div className="flex items-end gap-2">
          {[1, 2, 3, 4, 5, 6].map((step) => (
            <div key={step} className="bg-primary/80" style={{ width: 12, height: step * 4 }} />
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Cards p-5 · gutters px-6 · content max-w-5xl</p>
      </Variant>
      <Variant caption="Shadows" className="@min-[720px]:col-span-2">
        <div className="flex flex-wrap gap-4">
          {["shadow-xs", "shadow-sm", "shadow-md"].map((shadow) => (
            <div key={shadow} className={`rounded-lg border border-border bg-background px-4 py-3 text-xs ${shadow}`}>
              {shadow}
            </div>
          ))}
        </div>
      </Variant>
    </KitSection>
  );
}
