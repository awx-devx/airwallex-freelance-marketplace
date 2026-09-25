# 12 — Implementation Plan

Build in phases. Each phase ends with something demoable. **Phase 0 comes first** because several core assumptions (held Funds Splits, reversals of unreleased splits, minimal CA payloads) can only be confirmed against the sandbox.

## Phase 0 — Sandbox spike (scripts only, no UI)

Small standalone `tsx` scripts in `scripts/spike/`, sharing the real `src/lib/airwallex` client so the client gets built and tested here. Each prints results and writes raw responses to `scripts/spike/out/*.json`.

| Script | Verifies | Answers risk |
| --- | --- | --- |
| `01-auth.ts` | Login, token `expires_at`, API version header | R8 |
| `02-connected-account.ts` | Minimal `accounts/create` payload for an `INDIVIDUAL`; `submit`; `simulation/update_status` → `ACTIVE`; account tier | R1, R2 |
| `03-balances-and-ca-transfer.ts` | CA Transfer platform → CA; `balances/current` + `history` with `x-on-behalf-of` | R6 |
| `04-charge.ts` | Charge CA → platform; `source` accepts `acct_...`; any authorization prerequisites | R5 |
| `05-payment-intent.ts` | Create PI with `connected_account_id`; print `client_secret`. Then pay it by hand via a tiny static HTML page using Drop-in (`scripts/spike/checkout.html`) | R3 |
| `06-funds-split-held.ts` | After a PI succeeds: create 2 splits with `auto_release: false`; confirm status `CREATED`; wait N minutes/hours; release one; observe `RELEASED` → `SETTLED` and the destination balance increase | R3, R4 |
| `07-reversal-and-refund.ts` | On an unreleased split: create reversal, then partial refund. On a released split: reversal behaviour | R7 |
| `08-webhooks.ts` | Run a tiny server + tunnel; log real payloads for each subscribed event; verify signatures | R9 |

**Exit criteria:** a short `scripts/spike/FINDINGS.md` that resolves each risk in [13](./13-open-questions-and-risks.md) with the observed behaviour, and any doc updates. **If held splits don't work**, switch the default funding rail to wallet and keep the card rail as "payment acceptance + immediate split" (see fallback in 13).

## Phase 1 — Scaffold, auth, DB

- `create-next-app` (TypeScript, App Router, Tailwind, ESLint), `src/` directory.
- `src/lib/config.ts` (zod env), `src/lib/db.ts` (cached Mongoose connection), models from [04](./04-data-model.md).
- Auth: signup/login/logout, session cookie, `requireUser()`, middleware redirect for protected routes.
- Guest login endpoint (works once seed exists).
- Fill in the real npm script names in `AGENTS.md` if they differ from the planned ones.

**Demo:** sign up and log in; empty home page.

## Phase 2 — Airwallex client, provisioning, seed (users only)

- Finish `src/lib/airwallex/*` modules plus `airwallex_logs` logging.
- `services/provisioning.ts` with resumable steps; `/welcome` page.
- `scripts/seed.ts` users portion: Revenue account plus 8 seed users; `scripts/reset.ts`.
- Wallet chip in the header (current balance).

**Demo:** sign up and see a real `acct_...` with a $5,000 balance. Guest login works.

## Phase 3 — Offers and milestones (no money)

- `services/fees.ts` + unit tests.
- `/offers/new` with buyer search and live fee breakdown.
- `/offers/[id]` read views, decline/withdraw.
- Home page sections.
- Welcome offer generation at the end of provisioning.
- Delivery submission and request changes (state only).

**Demo:** send offers between users; see them on home pages.

## Phase 4 — Card funding + escrow creation

- `funding.startCardPayment`, `/offers/[id]/pay` with `DropInCheckout`, return page with reconcile.
- Webhook route with signature verification, `webhook_events`, and dispatcher.
- `escrow.onFundingSucceeded` creating held splits (idempotent).
- Sync endpoint + `PendingPoller`.
- Activity panel (logs + webhooks).

**Demo:** buyer pays by card; milestones show "Held in escrow" with split IDs.

## Phase 5 — Approval and release

- `escrow.approveMilestone` → release calls; `funds_split.*` handlers; `maybeMarkPaid`; offer completion.
- Wallet page: balances + history.

**Demo:** full happy path; seller balance increases; Revenue account increases.

## Phase 6 — Cancellation and refunds

- `escrow.refundMilestone` / `cancelRemaining` (card rail: reversal + refund); `refund.*` handlers.
- Terminal offer states.

**Demo:** cancel a milestone; buyer refunded.

## Phase 7 — Wallet rail + seeded contracts

- `funding.payFromWallet`, wallet-rail release/refund via CA Transfers, charge/transfer handlers.
- Seed offers in all states (uses wallet rail).
- `/platform` page with stuck-item retry.

**Demo:** log in as guest and see a rich, pre-populated dashboard.

## Phase 8 — Polish and deploy

- Empty states, loading states, error toasts, copy pass.
- Stretch: withdraw to bank; send to user; `SEQUENTIAL_MILESTONES` flag.
- Deploy to Vercel + Atlas; register the webhook; run seed; rehearse the demo script.
- Audit: `rg "DEMO-ONLY:"` matches the inventory in [10](./10-demo-vs-production.md).

## Testing strategy

| Layer | What | How |
| --- | --- | --- |
| Pure logic | `fees.breakdown`, money conversion, status rank / transition guards, request ID builders | Vitest unit tests |
| Webhook | Signature verification (known vector), idempotency (duplicate event), out-of-order events | Vitest with an in-memory Mongo (`mongodb-memory-server`) |
| Services | Escrow transitions with a mocked Airwallex client | Vitest |
| End to end | Happy path + refund against the real sandbox | Manual script in the runbook; optional Playwright later |

## Definition of done (demo)

- All flows in [05](./05-user-flows.md) work against the sandbox, with and without a webhook tunnel.
- Seed + reset are reliable and idempotent.
- Every shortcut is tagged and listed.
- The demo script in [11](./11-setup-and-runbook.md#4-demo-script-about-5-minutes) runs cleanly from a fresh seed.
