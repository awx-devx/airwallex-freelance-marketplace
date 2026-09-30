import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { statusVisual, type AnyStatus, type StatusTone, type StatusVisual } from "@/components/domain/status";
import { cn } from "cn";

const toneClass: Record<StatusTone, string> = {
  neutral: "bg-muted text-foreground",
  info: "bg-info/10 text-info",
  warning: "bg-warning/10 text-warning",
  success: "bg-success/10 text-success",
  danger: "bg-danger/10 text-danger",
  violet: "bg-primary/10 text-primary",
};

export function StatusPill({ status, visual = statusVisual(status) }: { status: AnyStatus; visual?: StatusVisual }) {
  const Icon = visual.icon;

  return (
    <Badge variant="neutral" className={cn("h-6 gap-1 px-2", toneClass[visual.tone], visual.muted && "text-muted-foreground")}>
      {visual.spinner ? <Spinner size="sm" /> : <Icon aria-hidden />}
      {visual.label}
    </Badge>
  );
}
