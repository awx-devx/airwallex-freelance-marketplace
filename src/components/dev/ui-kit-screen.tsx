"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { PrimitivesSection } from "@/components/dev/primitives-section";
import { TokensSection } from "@/components/dev/tokens-section";
import { cn } from "cn";

const nav = [
  ["tokens", "Tokens"],
  ["buttons", "Button"],
  ["inputs", "Input"],
  ["money-input", "MoneyInput"],
  ["form-field", "FormField"],
  ["select", "Select"],
  ["combobox", "Combobox"],
  ["checkbox", "Checkbox"],
  ["date-input", "DateInput"],
  ["card", "Card"],
  ["badge", "Badge"],
  ["tabs", "Tabs"],
  ["dialog", "Dialog"],
  ["dropdown-menu", "DropdownMenu"],
  ["tooltip", "Tooltip"],
  ["callout", "Callout"],
  ["skeleton", "Skeleton"],
  ["spinner", "Spinner"],
  ["avatar", "Avatar"],
  ["table", "Table"],
  ["progress", "Progress"],
  ["key-value-list", "KeyValueList"],
  ["copy-button", "CopyButton"],
  ["json-viewer", "JsonViewer"],
  ["empty-state", "EmptyState"],
  ["error-state", "ErrorState"],
  ["stepper", "Stepper"],
  ["timeline", "Timeline"],
  ["toaster", "Toaster"],
] as const;

const widths = [
  ["375", "max-w-[375px]"],
  ["768", "max-w-[768px]"],
  ["1024", "max-w-[1024px]"],
  ["full", "max-w-none"],
] as const;

type Width = (typeof widths)[number][0];
type ViewerRole = "buyer" | "seller";

export function UiKitScreen() {
  const [width, setWidth] = useState<Width>("full");
  const [viewerRole, setViewerRole] = useState<ViewerRole>("buyer");
  const [showLoading, setShowLoading] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const widthClass = widths.find((item) => item[0] === width)?.[1] ?? "max-w-none";

  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.scrollPaddingTop;
    root.style.scrollPaddingTop = "7rem";
    return () => {
      root.style.scrollPaddingTop = previous;
    };
  }, []);

  return (
    <div className="flex min-h-svh bg-surface text-foreground">
      <aside className="sticky top-0 hidden h-svh w-52 shrink-0 overflow-y-auto border-r border-border bg-background p-4 lg:block">
        <p className="text-sm font-semibold">UI kit</p>
        <p className="mt-1 text-xs text-muted-foreground">Primitives</p>
        <nav className="mt-4 flex flex-col gap-1">
          {nav.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
              {label}
            </a>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
          <div className="flex flex-wrap items-center gap-3">
            <nav className="flex gap-1 overflow-x-auto lg:hidden">
              {nav.map(([id, label]) => (
                <a key={id} href={`#${id}`} className="shrink-0 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted">
                  {label}
                </a>
              ))}
            </nav>
            <div className="flex items-center gap-1" role="group" aria-label="Width">
              {widths.map(([id]) => (
                <Button key={id} size="sm" variant={width === id ? "primary" : "outline"} onClick={() => setWidth(id)}>
                  {id}
                </Button>
              ))}
            </div>
            <ThemeToggle />
            <div className="flex items-center gap-1">
              {(["buyer", "seller"] as const).map((role) => (
                <Button
                  key={role}
                  size="sm"
                  variant={viewerRole === role ? "primary" : "outline"}
                  onClick={() => setViewerRole(role)}
                >
                  {role}
                </Button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={showLoading} onCheckedChange={setShowLoading} />
              Loading
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={showErrors} onCheckedChange={setShowErrors} />
              Errors
            </label>
          </div>
        </header>
        <div className={cn("@container mx-auto w-full px-4", widthClass)}>
          {showLoading ? (
            <div className="mt-6 flex flex-col gap-2 rounded-lg border border-border bg-background p-4">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : null}
          {showErrors ? (
            <div className="mt-6">
              <ErrorState message="Preview of an error state." onRetry={() => setShowErrors(false)} />
            </div>
          ) : null}
          <TokensSection />
          <PrimitivesSection />
        </div>
      </div>
    </div>
  );
}
