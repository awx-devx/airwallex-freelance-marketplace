import { Check, X } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "cn";

export type StepStatus = "pending" | "active" | "done" | "failed";

export type Step = {
  id: string;
  label: string;
  description?: string;
  status: StepStatus;
};

export function Stepper({ steps }: { steps: Step[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((step) => (
        <li key={step.id} className="flex items-start gap-3">
          <StepMarker status={step.status} />
          <div className="min-w-0">
            <p className={cn("text-sm font-medium", step.status === "pending" && "text-muted-foreground")}>
              {step.label}
            </p>
            {step.description ? <p className="text-sm text-muted-foreground">{step.description}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

function StepMarker({ status }: { status: StepStatus }) {
  if (status === "active") {
    return (
      <span className="mt-0.5 flex size-5 items-center justify-center text-warning">
        <Spinner size="sm" />
      </span>
    );
  }
  if (status === "done") {
    return (
      <span className="mt-0.5 flex size-5 items-center justify-center rounded-full bg-success text-white">
        <Check className="size-3" />
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="mt-0.5 flex size-5 items-center justify-center rounded-full bg-danger text-white">
        <X className="size-3" />
      </span>
    );
  }
  return <span className="mt-0.5 size-5 rounded-full border border-border bg-muted" />;
}
