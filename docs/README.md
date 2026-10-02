# Airwallex Freelance Marketplace — Demo Documentation

A demo freelance marketplace where a **seller** sends a milestone-based offer to a **buyer**, the buyer funds it up front, and each milestone's Funds Split stays unreleased (`auto_release: false`) until the buyer approves that milestone.

Everything runs on **one Airwallex sandbox account** (the "platform"). Every user who signs up gets their own **Airwallex connected account** (a real sandbox financial account with a wallet), which is where released funds land and where users can see balances and move money.

> This is a **demo**, not a production system. Shortcuts are deliberate and are tracked in [10-demo-vs-production.md](./10-demo-vs-production.md). Code comments follow the tagging convention described there (`DEMO-ONLY`, `PROD`, `AIRWALLEX`) so humans and LLMs can tell what is safe to copy.

## TL;DR of the design

| Concern | How it works in this demo |
| --- | --- |
| Payment acceptance | Buyer pays the **whole offer** once, via an Airwallex **PaymentIntent** rendered with the **Drop-in element** (sandbox test cards). |
| Unreleased funds | On `payment_intent.succeeded`, the server creates one **Funds Split per milestone per destination** with `auto_release: false`. Each split stays unreleased until the buyer approves that milestone. |
| Release on approval | When the buyer approves a milestone, the server calls **Release a Funds Split** for that milestone's splits. |
| Platform fee | Each milestone is split three ways: seller share, a seeded **Platform Revenue** connected account, and a small unsplit remainder left on the platform account to absorb Airwallex processing fees. |
| Refunds | Cancelling an unreleased milestone **reverses** its splits (Funds Split Reversal) and issues a **partial Refund** on the PaymentIntent. |
| User financial accounts | Every user = one Airwallex **business** connected account, created via API and force-activated with the sandbox simulation endpoint. Seed also creates the service-fee account the same way. |
| Wallet rail (secondary) | Users can also pay from their wallet balance using **Charges** (buyer to platform) and **Connected Account Transfers** (platform to seller). The seed script uses this rail too. |
| Status updates | Airwallex **webhooks** drive state changes. A "sync" fallback retrieves objects directly for local development. |
| Stack | Next.js (App Router) + MongoDB (Mongoose). **No Redis** (not needed; see architecture doc). |
| Frontend | REST API → typed API library → TanStack Query hooks. The UI is built first against an in-memory **mock transport**, using shadcn/ui + Tailwind and a `/dev/ui-kit` showcase page. |

## Reading order

1. [01-product-overview.md](./01-product-overview.md): what we're building, personas, scope, non-goals.
2. [02-architecture.md](./02-architecture.md): stack, folder layout, environment variables, Airwallex client design.
3. [03-airwallex-integration.md](./03-airwallex-integration.md): **the core doc**. Money model, funds flows, fee math, every Airwallex endpoint we call.
4. [04-data-model.md](./04-data-model.md): MongoDB collections, schemas, indexes, state machines.
5. [05-user-flows.md](./05-user-flows.md): each flow end to end (UI, server, Airwallex).
6. [06-api-routes.md](./06-api-routes.md): the REST API contract. Every route with request/response DTOs, the error envelope, and `allowedActions`.
7. [07-webhooks.md](./07-webhooks.md): subscriptions, signature verification, idempotency, handler map.
8. [08-seeding.md](./08-seeding.md): seed script, seed personas, guest accounts, reset.
9. [09-ui-pages.md](./09-ui-pages.md): design tokens, UI kit inventory, the `/dev/ui-kit` demo page, and per-page specs (data hooks, states, actions).
10. [10-demo-vs-production.md](./10-demo-vs-production.md): comment conventions and the full list of demo shortcuts.
11. [11-setup-and-runbook.md](./11-setup-and-runbook.md): sandbox setup, running locally, demo script, troubleshooting.
12. [12-implementation-plan.md](./12-implementation-plan.md): phased build plan, starting with a sandbox spike.
13. [13-open-questions-and-risks.md](./13-open-questions-and-risks.md): things to verify in the sandbox before committing.
14. [14-frontend-architecture.md](./14-frontend-architecture.md): API library, TanStack Query hooks, mock transport for UI-first development, and state management rules.

**Building the UI first?** Read 06 → 14 → 09, then follow Track U in 12.

## Glossary

| Term | Meaning here |
| --- | --- |
| Platform account | Our single Airwallex sandbox account. Owns all PaymentIntents, API keys, and webhooks. |
| Connected account (CA) | An Airwallex **business** account created under the platform for each user, and one more for the service fee (`acct_...`). Has its own multi-currency wallet. |
| Seller | The user who creates and sends an offer, and delivers milestones. |
| Buyer | The user who receives an offer, pays for it, and approves milestones. |
| Offer | A proposal from seller to buyer made up of one or more milestones. Once funded it's effectively a contract. |
| Milestone | A unit of work with its own amount. Its funds are released independently. |
| Funds Split | Airwallex object that routes part of a PaymentIntent to a connected account. With `auto_release: false` it is held until released. |
| Revenue account | The seeded business connected account that receives the platform-fee portion of each split. No login. Represents "platform earnings". |
| Card rail | Funding an offer with a card PaymentIntent plus Funds Splits. The primary demo path. |
| Wallet rail | Funding an offer from the buyer's CA wallet using Charges plus CA Transfers. |

## Key Airwallex references

- Docs index for LLMs: <https://www.airwallex.com/docs/llms.txt>
- Payment gateway for platforms (Funds Split): <https://www.airwallex.com/docs/payments-for-platforms/airwallex-gateway/airwallex-payment-gateway-overview.md>
- Collect payments directly (our model): <https://www.airwallex.com/docs/payments-for-platforms/airwallex-gateway/process-payments-and-manage-funds/collect-payments-directly.md>
- Funds Splits API: <https://www.airwallex.com/docs/api/payments/funds_splits.md>
- Funds Split Reversals API: <https://www.airwallex.com/docs/api/payments/funds_split_reversals.md>
- Connected accounts quickstart: <https://www.airwallex.com/docs/connected-accounts/get-started/quickstart-your-first-connected-account.md>
- Wallets and funds flow: <https://www.airwallex.com/docs/connected-accounts/about/wallets-and-funds-flow.md>
- Webhooks: <https://www.airwallex.com/docs/developer-tools/webhooks/listen-for-webhook-events.md>
- Sandbox settings: <https://www.airwallex.com/docs/developer-tools/sandbox-environment/sandbox-settings.md>
- AI agent integration notes: <https://www.airwallex.com/docs/developer-tools/ai-agent-instructions.md>
