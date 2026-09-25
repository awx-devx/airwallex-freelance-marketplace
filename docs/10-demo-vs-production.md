# 10 — Demo vs Production

This codebase is meant to be used as a **base** by humans and LLMs. The most important rule: **every deliberate shortcut is tagged in a code comment**, so nobody ships it to production by accident.

## Comment tagging convention

Use these exact prefixes. They are grep-able, and LLM-readable context depends on them being consistent.

| Tag | Meaning | Example |
| --- | --- | --- |
| `DEMO-ONLY:` | This exists **only** because it's a demo. It is unsafe or incorrect in production. Always follow it with `PROD:` explaining the real approach. | See below |
| `PROD:` | What a production system should do instead. Usually right after `DEMO-ONLY:`. Can also stand alone for a missing production concern. | |
| `SANDBOX:` | Relies on an Airwallex **sandbox-only** feature (simulation endpoints, test cards, pre-funded wallet). Will not work against production. | |
| `AIRWALLEX:` | A non-obvious Airwallex API behaviour or constraint the code depends on, ideally with a docs link. | |

Format:

```ts
// DEMO-ONLY: We agree to Airwallex T&Cs on the user's behalf and submit fixture identity data.
// PROD: Collect real identity + consent via Hosted Onboarding / Embedded KYC, handle RFIs,
//       and treat activation as async (account.active webhook).
// SANDBOX: simulation/accounts/{id}/update_status force-activates the account.
await awx.simulation.forceAccountStatus(accountId, 'ACTIVE');
```

```ts
// AIRWALLEX: Funds Splits can only be created after the PaymentIntent succeeds and BEFORE settlement.
// Sandbox settles back-to-back (T+0), so we create them the moment we learn of success.
// https://www.airwallex.com/docs/api/payments/funds_splits/create.md
```

Rules:

- Put the comment **at the place where the shortcut lives**, not in a distant README.
- Keep comments short and specific. State *what* and *what instead*, not a history of decisions.
- Every file with a `DEMO-ONLY` must also be listed in the table below (keep it updated in the same PR).
- The root `AGENTS.md` and `.cursor/rules/demo-comment-tags.mdc` restate these tags for agents. Keep all three in sync.

Audit commands:

```bash
rg -n "DEMO-ONLY:" src scripts
rg -n "SANDBOX:" src scripts
```

## Inventory of demo shortcuts

| Area | Demo behaviour | Production approach |
| --- | --- | --- |
| **Auth** | Email + password, **no email verification**, no rate limit, no lockout, no password reset | Verified email (magic link or OTP), rate limiting, lockout, reset flow, optional 2FA; or a managed auth provider |
| **Guest access** | "Continue as guest" logs into a **shared** seed account | No shared accounts. Per-visitor ephemeral sandboxes if a demo mode is needed |
| **Seed login list** | Login page lists seed accounts and their password | Never |
| **User directory** | Any user can search all users by email | Invite by email/link; privacy controls |
| **KYC / onboarding** | Fixture identity data, T&Cs agreed on the user's behalf, forced `ACTIVE` via simulation API | Hosted Onboarding / Embedded KYC; real consent; handle `ACTION_REQUIRED` and RFIs; async activation |
| **Provisioning** | Inline during sign-up, polled by the browser | Background job with retries and alerting |
| **Welcome credit** | Platform gives every user $5,000 from its sandbox wallet via CA Transfer | Not a thing. Balances come from real payments / deposits |
| **Welcome offer** | Auto-generated offer from a seed seller | Not a thing |
| **Seller cancel** | Seller can cancel a funded milestone and trigger a buyer refund unilaterally; buyer can cancel a submitted milestone unilaterally | Cancellation policy, mutual consent, and dispute/arbitration flow |
| **No auto-approval** | Money is held until the buyer acts (forever) | Auto-approve after N days of buyer inactivity (with notifications); hold-period limits per Airwallex config |
| **Refunds after release** | Not supported | Funds Split Reversal on settled split (claw back from seller) plus refund, via dispute resolution |
| **Disputes / chargebacks** | Ignored | Handle `payment_dispute.*` webhooks; the platform is MoR and liable; reserve policy |
| **Processing fee reserve** | Fixed % retained on platform to absorb Airwallex fees | Compute actual fees from settlement reports / balance history; reconcile |
| **Currency** | Single currency (`USD`) | Multi-currency pricing, FX (Conversions API), currency-precision handling |
| **Amount limits** | Min $10 per milestone; sandbox transaction limit is ~10,000 | Business rules plus Airwallex account limits |
| **Webhook processing** | Processed inline in the request; always returns 200 | Ack fast, enqueue, process async with retries; alert on failures |
| **Webhook test signatures** | Accepts `client-secret-key` header for web-app test events (non-prod only) | Never |
| **Sync endpoint** | Any participant can force-sync from Airwallex; UI polls it | Keep as an internal reconciliation job, not user-triggered |
| **`/platform` page** | Visible to any logged-in user (optional `DEMO_ADMIN_KEY`) | Proper admin RBAC and audit logs |
| **Token cache** | In-memory per server instance | Shared cache with a single-flight refresh; respect login rate limits |
| **`client_secret` persistence** | Stored on `payments` to re-render checkout | Don't persist; re-fetch PI or create a new one |
| **Logs** | Full request/response bodies (redacted) stored in Mongo and **shown to users** in the activity panel | Structured logs in an observability stack; never show raw API payloads to end users |
| **Concurrency** | Conditional Mongo updates only | Plus transactions where multi-document, plus an outbox pattern for external calls |
| **Deliverables** | Links only | File uploads with virus scanning and storage |
| **Mock transport** | UI can run entirely on in-memory mock data (`NEXT_PUBLIC_API_MOCKS=true`), including mock session and mock card form | Dev/preview only; refused in production builds unless `ALLOW_MOCKS_IN_PROD=true`; tree-shaken from real builds |
| **`/dev/ui-kit` page** | Component showcase available in development (and optionally in production via `NEXT_PUBLIC_ENABLE_UI_KIT`) | Internal tool, not shipped to users |
| **Client-side auth gating in mock mode** | `AppShell` redirects based on `useMe()`; no middleware check | Server-side session check (middleware) always |
| **Seed/reset scripts** | Move sandbox money, create accounts, wipe DB | Not present in production builds |
| **Compliance** | None (no sanctions screening UI, no tax forms, no ToS) | Platform ToS, seller agreements, tax forms (for example the Embedded Tax Form component), transaction monitoring response (RFIs) |
| **Secrets** | `.env.local` | Secret manager, key rotation, scoped/restricted API keys ([API key best practices](https://www.airwallex.com/docs/developer-tools/api/api-key-best-practices.md)) |

## Things that are production-grade on purpose

Keep these patterns as-is when building on this base:

- All Airwallex calls are server-side. The API key never reaches the browser.
- Amounts are derived server-side from stored offer data, never from the client.
- Integer minor units internally, converted at the Airwallex boundary.
- Deterministic `request_id`s for idempotent retries.
- Webhook signature verification with a raw body, timing-safe compare, and timestamp tolerance.
- Webhook idempotency via a unique `eventId` index, plus monotonic status transitions.
- Client-side checkout success treated as provisional until server-confirmed.
- Fee breakdown snapshotted at offer time.
