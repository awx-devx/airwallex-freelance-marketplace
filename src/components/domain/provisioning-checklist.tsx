import type { MeDTO } from "@/contracts/users";
import { provisioningChecklist } from "@/components/domain/provisioning-steps";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/ui/stepper";

export function ProvisioningChecklist({
  provisioning,
  running = false,
  onRetry,
}: {
  provisioning: MeDTO["provisioning"];
  /** True while a provisioning request is in flight, including a retry. */
  running?: boolean;
  onRetry?: () => void;
}) {
  const failed = provisioning.step === "FAILED";
  return (
    <div className="flex flex-col gap-3">
      <Stepper steps={provisioningChecklist(provisioning, running)} />
      {failed && !running ? (
        <Button type="button" variant="outline" className="w-fit" onClick={() => onRetry?.()}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}
