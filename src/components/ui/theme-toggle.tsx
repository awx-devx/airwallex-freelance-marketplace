"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ThemePreference } from "@/lib/themes";

const options: { id: ThemePreference; label: string; icon: typeof Sun }[] = [
  { id: "light", label: "Light", icon: Sun },
  { id: "system", label: "System", icon: Monitor },
  { id: "dark", label: "Dark", icon: Moon },
];

function subscribe() {
  return () => {};
}

export function ThemeToggle({
  variant = "segmented",
  className,
}: {
  variant?: "segmented" | "menu";
  className?: string;
}) {
  const { theme, setTheme } = useTheme();
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  const selected = options.findIndex((option) => option.id === theme);
  const current = selected >= 0 ? options[selected] : options[1];

  if (variant === "menu") {
    const Icon = ready ? current.icon : Monitor;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={className}
            aria-label={ready ? `Theme, ${current.label}` : "Theme"}
          >
            <Icon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuRadioGroup value={ready ? current.id : undefined} onValueChange={setTheme}>
            {options.map((option) => {
              const OptionIcon = option.icon;
              return (
                <DropdownMenuRadioItem key={option.id} value={option.id}>
                  <OptionIcon />
                  {option.label}
                </DropdownMenuRadioItem>
              );
            })}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn("relative inline-grid w-fit grid-cols-3 rounded-md bg-muted p-0.5", className)}
    >
      {ready && selected >= 0 ? (
        <span
          aria-hidden
          className="pointer-events-none absolute top-0.5 bottom-0.5 left-0.5 w-[calc((100%-0.25rem)/3)] rounded-sm bg-background shadow-none transition-transform duration-200"
          style={{ transform: `translateX(${selected * 100}%)` }}
        />
      ) : null}
      {options.map((option) => {
        const Icon = option.icon;
        const checked = ready && theme === option.id;

        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={option.label}
            title={option.label}
            onClick={() => setTheme(option.id)}
            className={cn(
              "relative z-10 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none max-md:size-11",
              checked && "text-foreground",
            )}
          >
            <Icon className="size-4" />
          </button>
        );
      })}
    </div>
  );
}
