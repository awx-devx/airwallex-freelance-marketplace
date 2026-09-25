import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ErrorState({
  message,
  onRetry,
  airwallex,
}: {
  message: string;
  onRetry?: () => void;
  airwallex?: { code?: string; traceId?: string };
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-danger/30 bg-danger/5 px-5 py-6" role="alert">
      <AlertTriangle className="size-5 text-danger" />
      <p className="text-sm font-medium">{message}</p>
      {airwallex?.code || airwallex?.traceId ? (
        <p className="font-mono text-xs text-muted-foreground">
          {airwallex.code ? <span>Airwallex {airwallex.code}</span> : null}
          {airwallex.code && airwallex.traceId ? <span> · </span> : null}
          {airwallex.traceId ? <span>trace {airwallex.traceId}</span> : null}
        </p>
      ) : null}
      {onRetry ? (
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}
