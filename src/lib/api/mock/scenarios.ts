import { armFault, emptyNewUser, getDb, replaceDb } from "@/lib/api/mock/db";
import { createSeedDb } from "@/lib/api/mock/fixtures";
import type { ScenarioId } from "@/lib/api/mock/types";

export const SCENARIOS: Array<{ id: ScenarioId; label: string }> = [
  { id: "fresh-seed", label: "Fresh seed" },
  { id: "empty-new-user", label: "Empty new user" },
  { id: "everything-pending", label: "Everything pending" },
  { id: "errors", label: "Next approve fails" },
];

export function applyScenario(id: ScenarioId) {
  if (id === "empty-new-user") {
    replaceDb(emptyNewUser());
    return;
  }

  const next = createSeedDb();
  next.scenario = id;

  if (id === "everything-pending") {
    const coffee = next.offers.find((offer) => offer.id === "off_coffee");
    if (coffee) {
      coffee.status = "AWAITING_PAYMENT";
      coffee.fundingRail = "CARD";
      coffee.payment = {
        rail: "CARD",
        status: "PENDING",
        attempt: 1,
        paymentIntentId: "int_mock_coffee_1",
        clientSecret: "cs_mock_coffee",
      };
    }
    const social = next.offers.find((offer) => offer.id === "off_social");
    const stuckAt = new Date(Date.now() - 3 * 60 * 1000).toISOString();
    if (social?.milestones[0] && social.milestones[1]) {
      social.milestones[0].status = "RELEASING";
      social.milestones[0].pendingSince = stuckAt;
      social.milestones[1].status = "REFUNDING";
      social.milestones[1].pendingSince = stuckAt;
    }
    next.sessionUserId = "usr_hannah";
  }

  if (id === "errors") next.sessionUserId = "usr_hannah";

  replaceDb(next);
  if (id === "errors") {
    armFault({
      pathIncludes: "/approve",
      times: 1,
      status: 502,
      code: "AIRWALLEX_ERROR",
      message: "Airwallex rejected the release.",
      airwallex: { code: "invalid_status_for_operation", traceId: "tr_mock" },
    });
  }
}

export function currentScenario(): ScenarioId {
  return getDb().scenario;
}
