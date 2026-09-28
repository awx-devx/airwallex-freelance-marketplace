import type { MeDTO } from "@/contracts/users";
import type { Step, StepStatus } from "@/components/ui/stepper";

export const PROVISIONING_CHECKLIST = ["ACCOUNT_CREATED", "SUBMITTED", "ACTIVE", "WELCOME_CREDITED", "READY"] as const;

const LABELS: Record<(typeof PROVISIONING_CHECKLIST)[number], string> = {
  ACCOUNT_CREATED: "Creating your Airwallex account",
  SUBMITTED: "Submitting account details",
  ACTIVE: "Activating",
  WELCOME_CREDITED: "Adding $5,000.00 demo credit",
  READY: "Preparing your first offer",
};

function statusFor(id: (typeof PROVISIONING_CHECKLIST)[number], current: MeDTO["provisioning"]["step"]): StepStatus {
  if (current === "FAILED") return "pending";
  if (current === "READY") return "done";
  if (current === "NONE") return id === "ACCOUNT_CREATED" ? "active" : "pending";
  const currentIndex = PROVISIONING_CHECKLIST.indexOf(current);
  const stepIndex = PROVISIONING_CHECKLIST.indexOf(id);
  if (stepIndex <= currentIndex) return "done";
  if (stepIndex === currentIndex + 1) return "active";
  return "pending";
}

/** Best checklist row when the request failed before the server recorded `failedStep`. */
export function inferredFailedStep(user: Pick<MeDTO, "airwallex" | "provisioning">): (typeof PROVISIONING_CHECKLIST)[number] {
  if (user.provisioning.failedStep) return user.provisioning.failedStep;
  if (!user.airwallex.accountId) return "ACCOUNT_CREATED";
  if (user.airwallex.accountStatus === "ACTIVE") return "WELCOME_CREDITED";
  if (user.airwallex.accountStatus === "SUBMITTED" || user.airwallex.accountStatus === "ACTION_REQUIRED") return "ACTIVE";
  return "SUBMITTED";
}

/** Checklist rows for `/welcome`. A failure marks `failedStep`; a retry shows that row as in progress. */
export function provisioningChecklist(provisioning: MeDTO["provisioning"], running = false): Step[] {
  const failed = provisioning.step === "FAILED" ? (provisioning.failedStep ?? "ACCOUNT_CREATED") : undefined;
  const failedIndex = failed ? PROVISIONING_CHECKLIST.indexOf(failed) : -1;
  return PROVISIONING_CHECKLIST.map((id, index) => {
    let status = statusFor(id, provisioning.step);
    if (failed) {
      if (index < failedIndex) status = "done";
      else if (index === failedIndex) status = running ? "active" : "failed";
      else status = "pending";
    }
    return {
      id,
      label: LABELS[id],
      status,
      description: status === "failed" ? provisioning.error : undefined,
    };
  });
}
