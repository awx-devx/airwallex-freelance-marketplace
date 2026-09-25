"use client";

import { useEffect, useState } from "react";
import { KitSection, Variant } from "@/components/dev/kit-section";

const colors = [
  ["Background", "bg-background"],
  ["Surface", "bg-surface"],
  ["Foreground", "bg-foreground"],
  ["Muted", "bg-muted-foreground"],
  ["Border", "bg-border"],
  ["Primary", "bg-primary"],
  ["Success", "bg-success"],
  ["Warning", "bg-warning"],
  ["Danger", "bg-danger"],
  ["Info", "bg-info"],
] as const;

const typeScale = [
  ["text-xs", "12px", "text-xs"],
  ["text-sm", "14px · default UI", "text-sm"],
  ["text-base", "16px", "text-base"],
  ["text-lg", "18px", "text-lg"],
  ["text-xl", "20px", "text-xl"],
  ["text-2xl", "24px", "text-2xl"],
  ["text-3xl", "30px · page titles, Newsreader", "font-serif text-3xl font-medium tracking-tight"],
] as const;

function rgbToHex(color: string) {
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return color;
  const hex = match
    .slice(1, 4)
    .map((channel) => Number(channel).toString(16).padStart(2, "0"))
    .join("");
  return `#${hex}`.toUpperCase();
}

function ColorSwatch({ name, className }: { name: string; className: string }) {
  const [hex, setHex] = useState("");

  useEffect(() => {
    const probe = document.createElement("div");
    probe.className = className;
    probe.style.position = "absolute";
    probe.style.visibility = "hidden";
    document.body.appendChild(probe);

    const read = () => setHex(rgbToHex(getComputedStyle(probe).backgroundColor));
    read();

    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", read);

    return () => {
      observer.disconnect();
      scheme.removeEventListener("change", read);
      probe.remove();
    };
  }, [className]);

  return (
    <div className="min-w-0">
      <div className={`h-10 rounded-md border border-border ${className}`} />
      <p className="mt-1 text-xs font-medium">{name}</p>
      <p className="font-mono text-xs text-muted-foreground">{hex}</p>
    </div>
  );
}

export function TokensSection() {
  return (
    <KitSection
      id="tokens"
      title="Tokens"
      note="Editorial fintech. Paper and ink, Newsreader for titles and amounts, Inter for UI. Swatches follow the active theme."
    >
      <Variant caption="Color" className="@min-[720px]:col-span-2">
        <div className="grid grid-cols-2 gap-3 @min-[520px]:grid-cols-5">
          {colors.map(([name, swatch]) => (
            <ColorSwatch key={name} name={name} className={swatch} />
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
            Inter: <span className="font-normal">400 body</span>, <span className="font-medium">500 labels</span>. Newsreader 500 for headings.
          </p>
        </div>
      </Variant>
      <Variant caption="Money · Newsreader" className="@min-[720px]:col-span-2">
        <p className="money text-5xl text-foreground">$1,250.00</p>
        <p className="mt-2 text-xs text-muted-foreground">The amount is the largest type on the screen. Tabular figures, one line.</p>
      </Variant>
      <Variant caption="Radius · 0.25rem">
        <div className="flex items-center gap-3">
          <div className="size-12 rounded-md border border-border bg-muted" />
          <div className="size-12 rounded-lg border border-border bg-muted" />
          <span className="text-xs text-muted-foreground">4px</span>
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
      <Variant caption="Elevation" className="@min-[720px]:col-span-2">
        <div className="flex flex-wrap items-start gap-4">
          <div className="rounded-lg border border-border bg-background px-4 py-3 text-xs">Hairline card</div>
          <div className="rounded-lg border border-border bg-popover px-4 py-3 text-xs shadow-md">Menu shadow</div>
        </div>
      </Variant>
    </KitSection>
  );
}
