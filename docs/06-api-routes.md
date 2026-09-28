# 06 — API Contract (REST routes + DTOs)

The browser talks to **our own REST API** (`src/app/api/**/route.ts`) through a typed **API library** (`src/lib/api`) wrapped in **TanStack Query hooks** (`src/hooks`). See [14-frontend-architecture.md](./14-frontend-architecture.md). There are no server actions for data mutations, so every call the UI makes can be served by the **mock transport** during UI-first development.

This document is the contract shared by three parties, all of which must agree:

1. **Route handlers** (real backend)
2. **Mock handlers** (`src/lib/api/mock`, used while building the UI)
3. **API library + hooks** (UI)

DTO types and request schemas live in **`src/contracts/*.ts`** as zod schemas with inferred types. They are imported by all three and are the single source of truth. If this doc and `src/contracts` disagree, fix both in the same commit.

**Frozen at U6 (2026-09-26).** The screens, mock handlers, and `src/contracts` agree with the routes below. A later change updates this doc, `src/contracts`, and the mocks in the same commit.

## Conventions

| Topic | Rule |
| --- | --- |
| Base path | `/api` (same origin; session cookie sent automatically) |
| Format | JSON in and out. `Content-Type: application/json`. |
| Money | Always `MoneyDTO = { amountMinor: number, currency: string }`. Integer minor units; the UI formats with the `Money` component. Request bodies from forms send amounts as **decimal strings** (`"450.00"`); the server converts. |
| Dates | ISO 8601 strings (`"2026-09-25T17:30:00.000Z"`). Date-only fields (`dueDate`) are `"YYYY-MM-DD"`. |
| IDs | Strings (Mongo ObjectId hex). Airwallex IDs (`acct_`, `int_`, `spt_`, `rfd_`) are passed through as-is. |
| Success | `200` with the resource (or `{ ok: true }` for void actions). `201` for creates. |
| Errors | Non-2xx with `ErrorDTO` (below). |
| Auth | Every route except `auth/*` and `config/public` requires a session → `401 UNAUTHENTICATED` otherwise. |
| Permissions | The server computes **`allowedActions`** for the current viewer on offers and milestones. The UI renders buttons from `allowedActions` and never re-derives role/state rules. |
| Mutations return state | Every mutation returns the **updated resource** (usually `OfferDTO`) so hooks can `setQueryData` without a refetch. |

### Error envelope

```ts
type ErrorDTO = {
  error: {
    code: ErrorCode;          // machine-readable, stable
    message: string;          // human-readable, safe to show in a toast
    fieldErrors?: Record<string, string[]>; // zod validation errors keyed by field path ("milestones.0.amount")
    airwallex?: { code?: string; traceId?: string }; // present when an Airwallex call failed (demo transparency)
  };
};

type ErrorCode =
  | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND'
  | 'VALIDATION_FAILED'       // 422, with fieldErrors
  | 'INVALID_STATE'           // 409, the offer/milestone isn't in the required status
  | 'INSUFFICIENT_BALANCE'    // 409, wallet rail
  | 'EMAIL_TAKEN'             // 409
  | 'INVALID_CREDENTIALS'     // 401
  | 'PROVISIONING_INCOMPLETE' // 409, user must finish /welcome
  | 'AIRWALLEX_ERROR'         // 502
  | 'INTERNAL';               // 500
```

## Shared DTOs (`src/contracts/common.ts`, `users.ts`)

```ts
type MoneyDTO = { amountMinor: number; currency: string };

type UserSummaryDTO = {
  id: string;
  name: string;
  headline?: string;
  avatarColor: string;          // e.g. "#7C3AED"
  initials: string;             // "MC"
};

type ProvisioningStep = 'NONE' | 'ACCOUNT_CREATED' | 'SUBMITTED' | 'ACTIVE' | 'WELCOME_CREDITED' | 'READY' | 'FAILED';

type MeDTO = UserSummaryDTO & {
  email: string;
  kind: 'REGULAR' | 'SEED';
  isGuest: boolean;             // session was created via "Continue as guest"
  airwallex: {
    accountId?: string;         // acct_...
    accountStatus?: 'CREATED' | 'SUBMITTED' | 'ACTIVE' | 'ACTION_REQUIRED' | 'SUSPENDED';
  };
  provisioning: { step: ProvisioningStep; error?: string };
};

type PublicConfigDTO = {
  currency: string;                    // "USD"
  platformFeePercent: number;          // 10
  processingReservePercent: number;    // 2
  minMilestoneMinor: number;           // 1000
  maxOfferTotalMinor: number;          // 900000
  maxMilestones: number;               // 10
  walletRailEnabled: boolean;
  airwallexEnv: 'demo' | 'prod';
  testCards: Array<{ number: string; label: string; outcome: 'success' | 'decline' | '3ds' }>;
  mocksEnabled: boolean;               // true when the UI runs on the mock transport
};
```

## Offer DTOs (`src/contracts/offers.ts`)

```ts
type OfferStatus = 'SENT' | 'AWAITING_PAYMENT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'DECLINED' | 'WITHDRAWN';

type MilestoneStatus =
  | 'PENDING_FUNDING' | 'FUNDED' | 'SUBMITTED' | 'CHANGES_REQUESTED'
  | 'RELEASING' | 'PAID' | 'RELEASE_FAILED'
  | 'REFUNDING' | 'REFUNDED' | 'REFUND_FAILED';

type OfferAction = 'ACCEPT_AND_PAY' | 'DECLINE' | 'WITHDRAW' | 'CONTINUE_PAYMENT' | 'CANCEL_PAYMENT' | 'CANCEL_REMAINING';
type MilestoneAction = 'SUBMIT_DELIVERY' | 'APPROVE' | 'REQUEST_CHANGES' | 'CANCEL' | 'RETRY';

type FeeBreakdownDTO = { seller: MoneyDTO; revenue: MoneyDTO; reserve: MoneyDTO; fee: MoneyDTO };

type DeliveryDTO = {
  id: string;
  links: string[];
  note?: string;
  submittedAt: string;
  review?: { decision: 'APPROVED' | 'CHANGES_REQUESTED'; comment?: string; reviewedAt: string };
};

type EscrowLegDTO = {                 // a Funds Split (card rail) or CA Transfer (wallet rail)
  kind: 'FUNDS_SPLIT' | 'CA_TRANSFER' | 'REFUND';
  share: 'SELLER' | 'REVENUE' | 'BUYER_REFUND';
  airwallexId: string;                // spt_..., transfer id, rfd_...
  amount: MoneyDTO;
  status: string;                     // Airwallex status as stored (CREATED, RELEASED, SETTLED, ACCEPTED, ...)
};

type MilestoneDTO = {
  id: string;
  index: number;
  title: string;
  description?: string;
  dueDate?: string;                   // YYYY-MM-DD
  amount: MoneyDTO;
  breakdown: FeeBreakdownDTO;
  status: MilestoneStatus;
  isPending: boolean;                 // RELEASING | REFUNDING, so the UI shows a spinner and polls
  deliveries: DeliveryDTO[];          // newest last
  escrowLegs: EscrowLegDTO[];
  allowedActions: MilestoneAction[];
  approvedAt?: string; paidAt?: string; refundedAt?: string;
  lastError?: string;                 // shown on *_FAILED or stuck states
};

type OfferSummaryDTO = {              // list/card view
  id: string;
  shortRef: string;                   // "OF-7K2Q"
  title: string;
  status: OfferStatus;
  viewerRole: 'BUYER' | 'SELLER';
  counterparty: UserSummaryDTO;
  total: MoneyDTO;
  released: MoneyDTO;                 // sum of PAID milestones
  refunded: MoneyDTO;
  milestoneCount: number;
  milestoneCounts: Partial<Record<MilestoneStatus, number>>;
  nextAction?: { label: string; milestoneId?: string }; // "Review delivery for Milestone 2"
  isWelcomeOffer: boolean;
  sentAt: string;
  updatedAt: string;
};

type OfferDTO = Omit<OfferSummaryDTO, 'counterparty'> & {
  description: string;
  seller: UserSummaryDTO;
  buyer: UserSummaryDTO;
  fundingRail?: 'CARD' | 'WALLET';
  feeSnapshot: { platformFeePercent: number; processingReservePercent: number };
  totals: { held: MoneyDTO; released: MoneyDTO; refunded: MoneyDTO; fees: FeeBreakdownDTO };
  milestones: MilestoneDTO[];
  allowedActions: OfferAction[];
  isPending: boolean;                 // AWAITING_PAYMENT or any milestone pending
  payment?: { rail: 'CARD' | 'WALLET'; status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED'; paymentIntentId?: string; chargeId?: string };
  acceptedAt?: string; fundedAt?: string; completedAt?: string;
};
```

### Example `OfferDTO` (trimmed)

```json
{
  "id": "66f3c0a1e4b0a1b2c3d4e5f6",
  "shortRef": "OF-7K2Q",
  "title": "Coffee brand identity",
  "description": "Full identity for Rivera Coffee Co.",
  "status": "ACTIVE",
  "viewerRole": "BUYER",
  "seller": { "id": "u_maya", "name": "Maya Chen", "headline": "Brand & identity designer", "avatarColor": "#7C3AED", "initials": "MC" },
  "buyer":  { "id": "u_sam",  "name": "Sam Rivera", "headline": "Founder, Rivera Coffee Co.", "avatarColor": "#0EA5E9", "initials": "SR" },
  "total": { "amountMinor": 150000, "currency": "USD" },
  "fundingRail": "CARD",
  "feeSnapshot": { "platformFeePercent": 10, "processingReservePercent": 2 },
  "totals": {
    "held": { "amountMinor": 120000, "currency": "USD" },
    "released": { "amountMinor": 30000, "currency": "USD" },
    "refunded": { "amountMinor": 0, "currency": "USD" },
    "fees": { "seller": { "amountMinor": 135000, "currency": "USD" }, "revenue": { "amountMinor": 12000, "currency": "USD" }, "reserve": { "amountMinor": 3000, "currency": "USD" }, "fee": { "amountMinor": 15000, "currency": "USD" } }
  },
  "milestones": [
    {
      "id": "m1", "index": 0, "title": "Moodboard", "amount": { "amountMinor": 30000, "currency": "USD" },
      "breakdown": { "seller": { "amountMinor": 27000, "currency": "USD" }, "revenue": { "amountMinor": 2400, "currency": "USD" }, "reserve": { "amountMinor": 600, "currency": "USD" }, "fee": { "amountMinor": 3000, "currency": "USD" } },
      "status": "PAID", "isPending": false, "deliveries": [], "allowedActions": [],
      "escrowLegs": [
        { "kind": "FUNDS_SPLIT", "share": "SELLER", "airwallexId": "spt_hkpd1k27vg1xc7u", "amount": { "amountMinor": 27000, "currency": "USD" }, "status": "SETTLED" },
        { "kind": "FUNDS_SPLIT", "share": "REVENUE", "airwallexId": "spt_hkpd1k27vg1xc8a", "amount": { "amountMinor": 2400, "currency": "USD" }, "status": "SETTLED" }
      ],
      "paidAt": "2026-09-25T17:42:00.000Z"
    },
    {
      "id": "m2", "index": 1, "title": "Logo", "amount": { "amountMinor": 70000, "currency": "USD" },
      "status": "SUBMITTED", "isPending": false,
      "deliveries": [{ "id": "d1", "links": ["https://www.figma.com/file/demo-logo"], "note": "Three directions, see page 2", "submittedAt": "2026-09-25T17:50:00.000Z" }],
      "allowedActions": ["APPROVE", "REQUEST_CHANGES", "CANCEL"]
    }
  ],
  "allowedActions": ["CANCEL_REMAINING"],
  "isPending": false
}
```

## Activity DTOs (`src/contracts/activity.ts`)

```ts
type ActivityItemDTO = {
  id: string;
  type: string;                        // OFFER_SENT, PAYMENT_SUCCEEDED, MILESTONE_PAID, ...
  message: string;                     // "Sam approved Milestone 2"
  actor?: UserSummaryDTO;
  milestoneId?: string;
  createdAt: string;
};

type AirwallexEventDTO =               // "Behind the scenes" panel row
  | { id: string; source: 'API_CALL'; at: string; method: string; path: string; status: number; durationMs: number;
      onBehalfOf?: string; requestBody?: unknown; responseBody?: unknown; errorCode?: string }
  | { id: string; source: 'WEBHOOK'; at: string; name: string; objectId?: string; processed: boolean;
      processingError?: string; payload: unknown };
```

## Wallet DTOs (`src/contracts/wallet.ts`)

```ts
type BalanceDTO = { currency: string; available: MoneyDTO; pending: MoneyDTO; reserved: MoneyDTO; total: MoneyDTO };

type WalletDTO = {
  account: { accountId: string; status: string; label: string };   // "Airwallex connected account (sandbox)"
  balances: BalanceDTO[];
  escrow: { heldAsBuyer: MoneyDTO; incomingAsSeller: MoneyDTO };
};

type TransactionDTO = {
  id: string;
  at: string;
  type: 'TRANSFER_IN' | 'TRANSFER_OUT' | 'CHARGE' | 'SPLIT' | 'SPLIT_REVERSAL' | 'PAYOUT' | 'DEPOSIT' | 'FEE' | 'OTHER';
  label: string;                        // friendly: "Milestone payment: Moodboard"
  amount: MoneyDTO;                     // signed: negative = outflow
  airwallexType?: string;               // raw transaction_type from balance history
  reference?: string;
};

type Page<T> = { items: T[]; nextCursor?: string };
```

## Payment DTOs (`src/contracts/payments.ts`)

```ts
type CardPaymentSessionDTO = {
  offerId: string;
  intentId: string;                     // int_... (mock: "int_mock_...")
  clientSecret: string;
  amount: MoneyDTO;
};
```

## Platform DTOs (`src/contracts/platform.ts`)

```ts
type PlatformOverviewDTO = {
  platformBalances: BalanceDTO[];
  revenueAccount: { accountId: string; balances: BalanceDTO[] };
  feesCollected: MoneyDTO;              // from our DB
  counts: { offers: Partial<Record<OfferStatus, number>>; milestones: Partial<Record<MilestoneStatus, number>> };
  stuck: Array<{ offerId: string; offerTitle: string; milestoneId: string; milestoneTitle: string; status: MilestoneStatus; since: string }>;
};

type WebhookEventRowDTO = { id: string; name: string; objectId?: string; receivedAt: string; processed: boolean; processingError?: string };
```

## Routes

`→` shows the success response body. Guards and effects are specified in [05-user-flows.md](./05-user-flows.md).

### Config and session

| Method | Path | Body / query | → | Notes |
| --- | --- | --- | --- | --- |
| GET | `/api/config/public` | – | `PublicConfigDTO` | No auth. Used by `FeeBreakdown`, pay page, banner. |
| GET | `/api/auth/demo-accounts` | – | `Array<UserSummaryDTO & { email: string; role: 'Seller' \| 'Buyer' \| 'Both' }>` | No auth. Login page "Log in as". `// DEMO-ONLY:` |
| POST | `/api/auth/signup` | `{ name, email, password, headline? }` | `MeDTO` (201) | Sets cookie. Errors: `EMAIL_TAKEN`, `VALIDATION_FAILED`. |
| POST | `/api/auth/login` | `{ email, password }` | `MeDTO` | Errors: `INVALID_CREDENTIALS`. |
| POST | `/api/auth/guest` | – | `MeDTO` | Random guest-pool user. |
| POST | `/api/auth/logout` | – | `{ ok: true }` | |
| GET | `/api/me` | – | `MeDTO` | `401` when logged out (the UI treats it as "no session"). |
| POST | `/api/me/provisioning` | – | `MeDTO` | Runs/resumes provisioning (idempotent). Poll `GET /api/me` for progress. |

### Users

| Method | Path | Body / query | → |
| --- | --- | --- | --- |
| GET | `/api/users/search` | `?q=` (≥ 2 chars) | `UserSummaryDTO[]` (max 10; excludes self, revenue, non-READY) |

### Offers

| Method | Path | Body / query | → |
| --- | --- | --- | --- |
| GET | `/api/offers` | `?view=incoming\|buying\|selling` | `OfferSummaryDTO[]` (newest first) |
| POST | `/api/offers` | `CreateOfferInput` (below) | `OfferDTO` (201, status `SENT`) |
| GET | `/api/offers/:id` | – | `OfferDTO` |
| POST | `/api/offers/:id/decline` | – | `OfferDTO` |
| POST | `/api/offers/:id/withdraw` | – | `OfferDTO` |
| POST | `/api/offers/:id/cancel-remaining` | `{ reason? }` | `OfferDTO` |
| POST | `/api/offers/:id/sync` | – | `OfferDTO` (re-reads Airwallex for pending objects) |
| GET | `/api/offers/:id/activity` | – | `ActivityItemDTO[]` |
| GET | `/api/offers/:id/airwallex-events` | – | `AirwallexEventDTO[]` (chronological) |

`view` semantics: `incoming` = buyer and status `SENT`/`AWAITING_PAYMENT`. `buying` = buyer and status `ACTIVE`/`COMPLETED`/`CANCELLED`. `selling` = seller and any status.

```ts
type CreateOfferInput = {
  buyerId: string;
  title: string;                        // 3–120 chars
  description: string;                  // ≤ 2000 chars
  milestones: Array<{ title: string; description?: string; amount: string; dueDate?: string }>; // 1–10; amount "450.00"
};
```

### Milestones

| Method | Path | Body | → |
| --- | --- | --- | --- |
| POST | `/api/offers/:id/milestones/:mid/deliveries` | `{ links: string[] (1–5 http(s) URLs), note?: string }` | `OfferDTO` |
| POST | `/api/offers/:id/milestones/:mid/request-changes` | `{ comment: string }` | `OfferDTO` |
| POST | `/api/offers/:id/milestones/:mid/approve` | – | `OfferDTO` (milestone `RELEASING`) |
| POST | `/api/offers/:id/milestones/:mid/cancel` | `{ reason?: string }` | `OfferDTO` (milestone `REFUNDING`) |
| POST | `/api/offers/:id/milestones/:mid/retry` | – | `OfferDTO` |

### Payments (funding)

| Method | Path | Body | → |
| --- | --- | --- | --- |
| POST | `/api/offers/:id/payments/card` | – | `CardPaymentSessionDTO` (creates or reuses PI; offer → `AWAITING_PAYMENT`) |
| POST | `/api/offers/:id/payments/reconcile` | – | `OfferDTO` (retrieves PI; funds escrow if succeeded) |
| POST | `/api/offers/:id/payments/cancel` | – | `OfferDTO` (back to `SENT`) |
| POST | `/api/offers/:id/payments/wallet` | – | `OfferDTO` (`AWAITING_PAYMENT`; errors `INSUFFICIENT_BALANCE`) |

### Wallet

| Method | Path | Body / query | → |
| --- | --- | --- | --- |
| GET | `/api/wallet` | – | `WalletDTO` |
| GET | `/api/wallet/transactions` | `?cursor=` | `Page<TransactionDTO>` |
| POST | `/api/wallet/withdrawals` (stretch) | `{ amount: string }` | `{ ok: true, transferId: string }` |
| POST | `/api/wallet/sends` (stretch) | `{ recipientId: string, amount: string }` | `{ ok: true }` |

### Platform (demo-only)

| Method | Path | → |
| --- | --- | --- |
| GET | `/api/platform/overview` | `PlatformOverviewDTO` |
| GET | `/api/platform/webhooks` | `WebhookEventRowDTO[]` (latest 50) |

### Webhook (not called by the UI)

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/webhooks/airwallex` | Raw-body signature verification, store, dispatch. See [07-webhooks.md](./07-webhooks.md). |

## Route handler shape (real backend)

```ts
// src/app/api/offers/[id]/milestones/[mid]/approve/route.ts
export const POST = route({}, async ({ user, params }) => {
  const offer = await escrow.approveMilestone({ actorId: user.id, offerId: params.id, milestoneId: params.mid });
  return toOfferDTO(offer, user.id);           // src/server/dto/offers.ts computes allowedActions
});
```

`route()` (in `src/server/http.ts`) requires a session (`401`). `publicRoute()` is the same wrapper for `auth/*` and `config/public`. Pass `{ body, query, successStatus }` for zod parsing (`422`). Both map typed service errors (`NotFound`, `Forbidden`, `InvalidState`, `InsufficientBalance`, `EmailTaken`, `AirwallexError`) to `ErrorDTO` + HTTP status.

`allowedActions` is computed by a **pure function** in `src/contracts/permissions.ts`, `offerActions(offer, viewerRole)` / `milestoneActions(milestone, offer, viewerRole)`. It is shared by the real DTO mapper and the mock handlers so both behave identically.

`// DEMO-ONLY:` No rate limiting, no lockout, no email verification, no CSRF token beyond `SameSite=Lax` cookies plus a same-origin check on mutating requests. `// PROD:` Add rate limiting, CSRF tokens or double-submit cookies, and audit logging.
