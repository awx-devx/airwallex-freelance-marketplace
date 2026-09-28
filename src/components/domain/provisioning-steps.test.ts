import { describe, expect, it } from "vitest";
import { inferredFailedStep, provisioningChecklist } from "@/components/domain/provisioning-steps";

describe("provisioningChecklist", () => {
  it("marks the step that stopped and keeps earlier steps done", () => {
    const steps = provisioningChecklist({
      step: "FAILED",
      failedStep: "ACTIVE",
      error: "Airwallex wasn't ready to activate the account yet.",
    });
    expect(steps.map((step) => step.status)).toEqual(["done", "done", "failed", "pending", "pending"]);
    expect(steps[2]?.description).toMatch(/wasn't ready/);
  });

  it("infers the stopped step from the account when the request never recorded one", () => {
    expect(
      inferredFailedStep({
        airwallex: { accountId: "acct_1", accountStatus: "SUBMITTED" },
        provisioning: { step: "SUBMITTED" },
      }),
    ).toBe("ACTIVE");
  });

  it("shows the failed step as in progress while a retry is running", () => {
    const steps = provisioningChecklist(
      { step: "FAILED", failedStep: "WELCOME_CREDITED", error: "The credit did not settle." },
      true,
    );
    expect(steps.map((step) => step.status)).toEqual(["done", "done", "done", "active", "pending"]);
    expect(steps[3]?.description).toBeUndefined();
  });
});
