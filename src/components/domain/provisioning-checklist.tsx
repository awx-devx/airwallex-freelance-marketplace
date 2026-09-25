import type { MeDTO } from "@/contracts/users";
import { Button } from "@/components/ui/button";
import { Stepper, type StepStatus } from "@/components/ui/stepper";

const ORDER = ["ACCOUNT_CREATED", "SUBMITTED", "ACTIVE", "WELCOME_CREDITED", "READY"] as const;

const LABELS: Record<(typeof ORDER)[number], string> = {
  ACCOUNT_CREATED: "Creating your Airwallex account",
  SUBMITTED: "Submitting account details",
  ACTIVE: "Activating",
  WELCOME_CREDITED: "Adding $5,000.00 demo credit",
  READY: "Preparing your first offer",
};

function stepStatus(id: (typeof ORDER)[number], current: MeDTO["provisioning"]["step"]): StepStatus {
  if (current === "FAILED") return id === "ACCOUNT_CREATED" ? "failed" : "pending";
  if (current === "READY") return "done";
  if (current === "NONE") return id === "ACCOUNT_CREATED" ? "active" : "pending";
  const currentIndex = ORDER.indexOf(current);
  const stepIndex = ORDER.indexOf(id);
  if (stepIndex <= currentIndex) return "done";
  if (stepIndex === currentIndex + 1) return "active";
  return "pending";
}

export function ProvisioningChecklist({
  provisioning,
  onRetry,
}: {
  provisioning: MeDTO["provisioning"];
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Stepper
        steps={ORDER.map((id) => ({
          id,
          label: LABELS[id],
          status: stepStatus(id, provisioning.step),
          description: provisioning.step === "FAILED" && id === "ACCOUNT_CREATED" ? provisioning.error : undefined,
        }))}
      />
      {provisioning.step === "FAILED" ? (
        <Button type="button" variant="outline" className="w-fit" onClick={() => onRetry?.()}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}
