import { Loader2 } from "lucide-react";
import { cn } from "cn";

const sizes = {
  sm: "size-3",
  md: "size-4",
  lg: "size-6",
} as const;

export function Spinner({
  size = "md",
  className,
  decorative = false,
  label = "Loading",
}: {
  size?: keyof typeof sizes;
  className?: string;
  decorative?: boolean;
  label?: string;
}) {
  return (
    <Loader2
      className={cn("animate-spin", sizes[size], className)}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : label}
      role={decorative ? undefined : "status"}
    />
  );
}
