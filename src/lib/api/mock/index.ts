import { ApiError } from "@/lib/api/errors";
import type { Transport } from "@/lib/api/transport";
import * as actions from "@/lib/api/mock/actions";
import { consumeFault, getDb, latencyDelayMs, setLatencyOverride } from "@/lib/api/mock/db";
import { createRouter, type Route } from "@/lib/api/mock/router";
import { applyScenario } from "@/lib/api/mock/scenarios";
import { flushMockWebhooks } from "@/lib/api/mock/simulate";

const routes: Route[] = [
  { method: "GET", pattern: "/api/config/public", handler: () => actions.publicConfig() },
  { method: "GET", pattern: "/api/auth/demo-accounts", handler: () => actions.demoAccounts() },
  { method: "POST", pattern: "/api/auth/signup", handler: ({ body }) => actions.signup(body) },
  { method: "POST", pattern: "/api/auth/login", handler: ({ body }) => actions.login(body) },
  { method: "POST", pattern: "/api/auth/guest", handler: () => actions.guest() },
  { method: "POST", pattern: "/api/auth/logout", handler: () => actions.logout() },
  { method: "GET", pattern: "/api/me", handler: () => actions.me() },
  { method: "POST", pattern: "/api/me/provisioning", handler: () => actions.runProvisioning() },
  { method: "GET", pattern: "/api/users/search", handler: ({ query }) => actions.searchUsers(query) },
  { method: "GET", pattern: "/api/offers", handler: ({ query }) => actions.listOffers(query?.view) },
  { method: "POST", pattern: "/api/offers", handler: ({ body }) => actions.createOffer(body) },
  { method: "GET", pattern: "/api/offers/:id", handler: ({ params }) => actions.getOffer(params.id ?? "") },
  { method: "POST", pattern: "/api/offers/:id/decline", handler: ({ params }) => actions.declineOffer(params.id ?? "") },
  { method: "POST", pattern: "/api/offers/:id/withdraw", handler: ({ params }) => actions.withdrawOffer(params.id ?? "") },
  { method: "POST", pattern: "/api/offers/:id/cancel-remaining", handler: ({ params, body }) => actions.cancelRemaining(params.id ?? "", body) },
  { method: "POST", pattern: "/api/offers/:id/sync", handler: ({ params }) => actions.syncOffer(params.id ?? "") },
  { method: "GET", pattern: "/api/offers/:id/activity", handler: ({ params }) => actions.offerActivity(params.id ?? "") },
  { method: "GET", pattern: "/api/offers/:id/airwallex-events", handler: ({ params }) => actions.offerEvents(params.id ?? "") },
  { method: "POST", pattern: "/api/offers/:id/milestones/:mid/deliveries", handler: ({ params, body }) => actions.submitDelivery(params.id ?? "", params.mid ?? "", body) },
  { method: "POST", pattern: "/api/offers/:id/milestones/:mid/request-changes", handler: ({ params, body }) => actions.requestChanges(params.id ?? "", params.mid ?? "", body) },
  { method: "POST", pattern: "/api/offers/:id/milestones/:mid/approve", handler: ({ params }) => actions.approveMilestone(params.id ?? "", params.mid ?? "") },
  { method: "POST", pattern: "/api/offers/:id/milestones/:mid/cancel", handler: ({ params, body }) => actions.cancelMilestone(params.id ?? "", params.mid ?? "", body) },
  { method: "POST", pattern: "/api/offers/:id/milestones/:mid/retry", handler: ({ params }) => actions.retryMilestone(params.id ?? "", params.mid ?? "") },
  { method: "POST", pattern: "/api/offers/:id/payments/card", handler: ({ params }) => actions.startCard(params.id ?? "") },
  { method: "POST", pattern: "/api/offers/:id/payments/reconcile", handler: ({ params }) => actions.reconcile(params.id ?? "") },
  { method: "POST", pattern: "/api/offers/:id/payments/cancel", handler: ({ params }) => actions.cancelPayment(params.id ?? "") },
  { method: "POST", pattern: "/api/offers/:id/payments/wallet", handler: ({ params }) => actions.payFromWallet(params.id ?? "") },
  { method: "GET", pattern: "/api/wallet", handler: () => actions.wallet() },
  { method: "GET", pattern: "/api/wallet/transactions", handler: ({ query }) => actions.transactions(query?.cursor) },
  { method: "POST", pattern: "/api/wallet/withdrawals", handler: ({ body }) => actions.withdraw(body) },
  { method: "POST", pattern: "/api/wallet/sends", handler: ({ body }) => actions.sendFunds(body) },
  { method: "GET", pattern: "/api/platform/overview", handler: () => actions.platformOverview() },
  { method: "GET", pattern: "/api/platform/webhooks", handler: () => actions.platformWebhooks() },
  { method: "POST", pattern: "/api/platform/unlock", handler: () => ({ ok: true as const }) },
];

const match = createRouter(routes);

function sleep(ms: number) {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// DEMO-ONLY: In-memory stand-in for /api, including a localStorage session and plaintext passwords.
// PROD: The browser calls real route handlers. Sessions are signed cookies and passwords are hashed.
export const mockTransport: Transport = {
  async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
    query?: Record<string, string | undefined>,
  ): Promise<T> {
    await sleep(latencyDelayMs());
    const fault = consumeFault(path);
    if (fault) {
      throw new ApiError({
        status: fault.status,
        code: fault.code,
        message: fault.message,
        airwallex: fault.airwallex,
      });
    }
    const route = match(method, path);
    if (!route) throw new ApiError({ status: 404, code: "NOT_FOUND", message: `No mock route for ${method} ${path}` });
    return (await route.handler({ params: route.params, body, query })) as T;
  },
};

export function resetMockDb() {
  applyScenario("fresh-seed");
}

export function setMockLatency(ms: number) {
  setLatencyOverride(ms);
}

export { applyScenario, flushMockWebhooks, getDb };

export const setMockUser = actions.setMockUser;
export const submitMockCard = actions.submitMockCard;
