# 06 — Server Actions and API Routes

Convention: **mutations triggered from our own UI are server actions** (`src/app/**/actions.ts`). **Route handlers** (`src/app/api/**/route.ts`) are used for auth endpoints, polling/sync, search, and the webhook.

Every action/handler follows the same shape:

```ts
export async function approveMilestone(input: unknown) {
  const user = await requireUser();                 // session -> user, throws 401
  const { offerId, milestoneId } = ApproveSchema.parse(input);
  return escrow.approveMilestone({ actorId: user._id, offerId, milestoneId });
}
```

Services throw typed errors (`NotFound`, `Forbidden`, `InvalidState`, `AirwallexError`). A shared wrapper maps them to `{ ok: false, error: { code, message } }` for server actions, or to HTTP status codes for route handlers.

## Auth

| Endpoint | Input | Result |
| --- | --- | --- |
| `POST /api/auth/signup` | `{ name, email, password, headline? }` | Creates user, sets cookie, `{ redirect: '/welcome' }` |
| `POST /api/auth/login` | `{ email, password }` | Sets cookie, `{ redirect: '/' \| '/welcome' }` |
| `POST /api/auth/guest` | – | Picks a random guest-pool user, sets cookie, `{ redirect: '/' }` |
| `POST /api/auth/logout` | – | Clears cookie |

Session cookie: `session` is an httpOnly, `SameSite=Lax`, `Secure`-in-production signed JWT (`jose`, HS256, 7-day expiry) containing `{ sub: userId }`.

`// DEMO-ONLY:` No rate limiting, no lockout, no email verification, and no CSRF token beyond SameSite plus server actions' built-in origin check.

## Provisioning

| Endpoint | Input | Result |
| --- | --- | --- |
| action `provisioning.runForCurrentUser()` | – | Runs/resumes provisioning; returns `{ step, error? }` |
| `GET /api/me/provisioning` | – | `{ step, accountId?, error? }`, polled by `/welcome` |

## Users

| Endpoint | Input | Result |
| --- | --- | --- |
| `GET /api/users/search?q=` | `q` ≥ 2 chars | `[{ id, name, email, headline }]`, max 10. Excludes self and `REVENUE` users. `READY` users only. |

`// DEMO-ONLY:` The user directory is searchable by anyone logged in. It exposes emails.

## Offers

| Action | Input | Guard | Effect |
| --- | --- | --- | --- |
| `offers.createAndSend` | `{ buyerId, title, description, milestones: [{ title, description?, amount, dueDate? }] }` | seller = caller; buyer READY | Offer `SENT` |
| `offers.decline` | `{ offerId }` | buyer; `SENT` | `DECLINED` |
| `offers.withdraw` | `{ offerId }` | seller; `SENT` | `WITHDRAWN` |
| `offers.submitDelivery` | `{ offerId, milestoneId, links: string[], note? }` | seller; milestone `FUNDED`/`CHANGES_REQUESTED` | `SUBMITTED` |
| `offers.requestChanges` | `{ offerId, milestoneId, comment }` | buyer; `SUBMITTED` | `CHANGES_REQUESTED` |

`amount` is accepted as a decimal string (`"450.00"`) and converted to minor units server-side.

## Funding

| Action | Input | Guard | Effect |
| --- | --- | --- | --- |
| `funding.startCardPayment` | `{ offerId }` | buyer; `SENT`/`AWAITING_PAYMENT` | Creates/reuses PI; returns `{ intentId, clientSecret, currency, amount }` |
| `funding.reconcileCardPayment` | `{ offerId }` | buyer or seller | Retrieves PI; calls `escrow.onFundingSucceeded` if `SUCCEEDED` |
| `funding.cancelPendingPayment` | `{ offerId }` | buyer; `AWAITING_PAYMENT` | Payment `CANCELLED`, offer back to `SENT` |
| `funding.payFromWallet` | `{ offerId }` | buyer; `SENT`; balance ≥ total | Creates charge; offer `AWAITING_PAYMENT` |

## Escrow

| Action | Input | Guard | Effect |
| --- | --- | --- | --- |
| `escrow.approveMilestone` | `{ offerId, milestoneId }` | buyer; `SUBMITTED` | `RELEASING`; release splits / create transfers |
| `escrow.refundMilestone` | `{ offerId, milestoneId, reason? }` | buyer or seller; unreleased | `REFUNDING`; reversal + refund / refund transfer |
| `escrow.cancelRemaining` | `{ offerId, reason? }` | buyer or seller; `ACTIVE` | `refundMilestone` for each unreleased milestone |
| `escrow.retry` | `{ offerId, milestoneId }` | participant or admin | Re-runs the pending release/refund step (safe: deterministic request IDs) |

## Sync (webhook fallback)

| Endpoint | Effect |
| --- | --- |
| `POST /api/offers/[id]/sync` | For the offer's payment, splits, refunds, and transfers in non-terminal states, retrieves each object from Airwallex and applies the same transition functions the webhook handlers use. Returns the updated offer. |

The offer page calls sync automatically every 3s while anything is in `AWAITING_PAYMENT`, `RELEASING`, or `REFUNDING` (stops after 60s), and exposes a manual **Sync with Airwallex** button. This makes the demo work even when webhooks can't reach localhost.

## Wallet

| Endpoint | Result |
| --- | --- |
| `GET /api/wallet/balances` | Current balances for caller's CA |
| `GET /api/wallet/history?page=` | Balance history for caller's CA |
| action `wallet.withdraw` (stretch) | `{ amount, currency }` → beneficiary (cached per user) + transfer |
| action `wallet.sendToUser` (stretch) | `{ recipientId, amount }` → charge + CA transfer |

## Platform (demo-only)

| Endpoint | Result |
| --- | --- |
| `GET /api/platform/overview` | Platform balances, Revenue CA balances, counts by status |
| `GET /api/platform/webhooks?limit=50` | Recent webhook events |

## Webhook

| Endpoint | Notes |
| --- | --- |
| `POST /api/webhooks/airwallex` | Raw-body signature verification, store, dispatch. See [07-webhooks.md](./07-webhooks.md). Always returns `200` quickly once stored, even if processing fails; failures are recorded and retried via sync. |
