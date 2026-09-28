# 05 — User Flows

Each flow lists **UI**, **server**, **Airwallex**, and **DB** effects. Airwallex endpoint details are in [03-airwallex-integration.md](./03-airwallex-integration.md). Names like `escrow.approveMilestone` are **service functions**. The REST route that calls each one, and its request/response DTOs, are in [06-api-routes.md](./06-api-routes.md). The mock transport ([14](./14-frontend-architecture.md#4-mock-transport-srclibapimock--ui-first-development)) simulates the same transitions.

---

## F1. Sign up

**UI:** `/signup`. Fields: name, email, password, optional headline. Copy says "No email verification — this is a demo."

**Server (`POST /api/auth/signup`):**

1. Validate with zod. Email must be unique (case-insensitive).
2. Create `users` doc with `kind: REGULAR`, `provisioning.step: NONE`.
3. Set the session cookie.
4. Redirect to `/welcome` (a provisioning screen), which calls `provisioning.run(userId)` and polls status.

**Provisioning (`src/services/provisioning.ts`)**, resumable by step:

| Step | Airwallex | DB |
| --- | --- | --- |
| Create CA | `POST /accounts/create` with the `BUSINESS` body in [03 §7](./03-airwallex-integration.md#7-connected-account-provisioning) | `accountId`, step `ACCOUNT_CREATED` |
| Submit | `POST /accounts/{id}/submit` | step `SUBMITTED` |
| Force active | `POST /simulation/accounts/{id}/update_status` (`ACTIVE`, `force: true`) | step `ACTIVE`, `accountStatus: ACTIVE` |
| Welcome credit | `POST /connected_account_transfers/create` (`WELCOME_CREDIT_AMOUNT`) | step `WELCOME_CREDITED` |
| Welcome offer | – | create an offer from a random `SEED` seller (see [08](./08-seeding.md#welcome-offer-templates)); step `READY` |

**UI states:** a checklist that ticks as steps finish ("Creating your Airwallex account… Activating… Adding $5,000 demo credit… Preparing your first offer…"). On `FAILED`, mark `failedStep`, show the error, and offer **Retry**. Retry calls the same `runProvisioning` as `npm run seed`: it resumes from the stored account and does not create a second one. Sandbox activation is retried for about 20 seconds when Airwallex says the account was only just submitted. Leaving `/welcome` and coming back keeps polling until the in-flight run finishes.

`// DEMO-ONLY:` Provisioning runs inline in the request/poll cycle. `// PROD:` Run it as a background job, and treat account activation as asynchronous (real KYC can take days).

---

## F2. Log in

**UI:** `/login`. Email + password, plus a **Continue as guest** button. It also lists the seed accounts with a "log in as" shortcut (demo convenience, password shown: `demo1234`).

**Server:** verify bcrypt hash, then set the session cookie. If the user's provisioning isn't `READY`, redirect to `/welcome` to resume.

---

## F3. Continue as guest

**Server (`POST /api/auth/guest`):**

1. Pick a random user where `isGuestPool: true` and `airwallex.provisioning.step: READY`.
2. Set the session cookie for that user. The banner says "You're exploring as **Sam Rivera** (shared demo account)".

`// DEMO-ONLY:` Guests share accounts, so two visitors can act on the same data at once. Conditional updates prevent corruption, but visitors may see each other's actions. That's acceptable for a demo. Keep a reasonably large guest pool (6–10), and use `scripts/reset.ts` to restore state.

---

## F4. Home page

**UI:** `/` has three sections:

1. **Incoming offers** (buyer = me, status `SENT` or `AWAITING_PAYMENT`): card with seller, title, total, milestone count, and **Review** button.
2. **My contracts as buyer** (`ACTIVE`/`COMPLETED`/`CANCELLED`): progress bar (paid / total), next action ("Review delivery for Milestone 2").
3. **My contracts as seller** plus **Sent offers**: status, next action ("Deliver Milestone 1").

A header shows a wallet balance chip (from `GET /balances/current` on behalf of the user, cached per request) and a **New offer** button.

---

## F5. Create and send an offer (seller)

**UI:** `/offers/new`

- Buyer picker: search users by name/email (`GET /api/users/search?q=`), excluding self and the Revenue user.
- Title, description.
- Milestones repeater: title, description, amount, optional due date. Add/remove/reorder, max 10.
- **Live fee breakdown panel:** per milestone and in total: "Buyer pays $1,000 · You receive $900 · Platform fee $100 (Revenue account $80, processing reserve $20)".
- Submit: **Send offer**.

**Server (`offers.createAndSend`):**

1. Validate: buyer exists and is `READY`; buyer ≠ seller; 1–10 milestones; each ≥ $10.00; total ≤ $9,000 (sandbox transaction limit, see R14); currency = `DEMO_CURRENCY`.
2. Compute `breakdown` per milestone with `fees.breakdown`, and snapshot `feeSnapshot`.
3. Insert offer (`SENT`), activity `OFFER_SENT`.

No Airwallex calls happen yet.

---

## F6. Review, accept, and pay (buyer)

**UI:** `/offers/[id]` (buyer view, status `SENT`): offer details, milestone table with amounts, and seller profile. Buttons: **Accept & pay**, **Decline**.

**Accept & pay** goes to `/offers/[id]/pay`, which offers a choice:

- **Pay by card** (default): renders the Drop-in element. Test card hint box.
- **Pay from wallet** (if `ENABLE_WALLET_RAIL`): shows current balance and a **Pay $X from wallet** button, disabled if insufficient.

### Card rail

1. Page load calls `POST /api/offers/:id/payments/card`, which runs `funding.startCardPayment(offerId)`:
   - Guard: caller is buyer; offer is `SENT` or `AWAITING_PAYMENT`.
   - Reuse an existing `PENDING` payment if its PI is still payable; otherwise create payment attempt N and `POST /pa/payment_intents/create` with `amount = total`, `currency`, `merchant_order_id = offerId`, `request_id = pi:{offerId}:{N}`, `metadata = { offerId, offerRef }`, `return_url = {APP_URL}/offers/{id}/pay/return`. Omit `connected_account_id` (this sandbox rejects it). The later Funds Splits still name the seller and Revenue business accounts as `destination`.
   - Offer → `AWAITING_PAYMENT`.
   - Returns `{ intentId, clientSecret, currency }`.
2. Buyer enters test card `4035 5010 0000 0008`. Drop-in confirms directly with Airwallex.
3. On `success`, navigate to `/offers/[id]/pay/return`. That page calls `funding.reconcileCardPayment(offerId)`, which retrieves the PI; if `SUCCEEDED`, it calls `escrow.onFundingSucceeded(offerId)`.
4. Independently, webhook `payment_intent.succeeded` calls the same `escrow.onFundingSucceeded(offerId)`. **Whichever arrives first wins.** The other becomes a no-op.
5. `escrow.onFundingSucceeded`:
   - Payment → `SUCCEEDED`.
   - For each milestone: create seller split and revenue split (`auto_release: false`, deterministic request IDs, `metadata = { offerId, milestoneId, share }`). Milestone → `FUNDED`.
   - Offer → `ACTIVE`, `fundedAt`, activity `PAYMENT_SUCCEEDED` + `SPLITS_CREATED`.
6. The return page shows "Payment received — $1,000 is held in escrow" and links back to the offer.

If the payment fails (`payment_intent.payment_failed` or a Drop-in `error`), the payment → `FAILED` and the offer → `SENT` so the buyer can retry.

### Wallet rail

1. `funding.payFromWallet(offerId)`: guard as above; check the buyer CA `available_amount`; `POST /charges/create` with `source = buyerCA`, `request_id = ch:{offerId}`, `reference = Escrow funding {shortRef}`. `reason` is the enum `professional_business_services` (the API rejects free text).
2. Offer → `AWAITING_PAYMENT`. The UI shows "Processing…" and polls `/api/offers/[id]/sync`.
3. Webhook `charge.settled` (or sync retrieving the charge) calls `escrow.onFundingSucceeded(offerId)`. For the wallet rail, this just marks milestones `FUNDED`. Escrow is the platform balance; no splits are created.

### Decline

Offer → `DECLINED`, activity. No Airwallex calls.

---

## F7. Deliver a milestone (seller)

**UI:** `/offers/[id]` (seller view). Each `FUNDED` or `CHANGES_REQUESTED` milestone has a **Submit delivery** form: 1–5 URLs (validated as `http(s)`) and an optional note.

**Server (`offers.submitDelivery`):** guard seller + status; push `deliveries[]` entry; milestone → `SUBMITTED`; activity `DELIVERY_SUBMITTED`. With `SEQUENTIAL_MILESTONES=true` (default false), delivery is refused until the previous milestone is `PAID`. The same check hides **Submit delivery** on the offer.

No Airwallex calls happen.

---

## F8. Review a delivery (buyer)

**UI:** a milestone in `SUBMITTED` shows the latest delivery links and note, with buttons **Approve & release $X** and **Request changes** (with comment).

### Approve

**Server (`escrow.approveMilestone`):**

1. Conditional update: milestone `SUBMITTED` → `RELEASING`; set `delivery.review`; `approvedAt`.
2. **Card rail:** `POST /pa/funds_splits/{sellerSplitId}/release` and `.../{revenueSplitId}/release` (request IDs `fsr:{splitId}`). Update split statuses from the responses (`RELEASED`).
   **Wallet rail:** `POST /connected_account_transfers/create` to seller CA (`sellerMinor`) and to Revenue CA (`revenueMinor`).
3. If a release call errors, keep `RELEASING`, record `lastError`, and show "Release pending — retry" (retry is safe because request IDs are deterministic).
4. Activity `MILESTONE_APPROVED`, `FUNDS_RELEASED`.

**Webhooks:** `funds_split.settled` (card) or `connected_account_transfer.settled` (wallet) updates the specific split/transfer. When both seller and revenue legs are settled, milestone → `PAID`, `paidAt`, activity `MILESTONE_PAID`. If every milestone is terminal, the offer → `COMPLETED`.

### Request changes

Milestone → `CHANGES_REQUESTED`, review comment saved. The seller sees the comment and resubmits.

---

## F9. Cancel a milestone / refund (buyer or seller)

**UI:** a **Cancel milestone** action (confirm dialog: "$X will be refunded to the buyer's card") on unreleased milestones. There's also **Cancel remaining contract**, which applies the cancel to every unreleased milestone.

**Server (`escrow.refundMilestone`):**

1. Conditional update → `REFUNDING`.
2. **Card rail:**
   1. For each split, `POST /pa/funds_split_reversals/create { funds_split_id, amount }` (request ID `fsrev:{splitId}`). See the risk note on reversing unreleased splits.
   2. `POST /pa/refunds/create { payment_intent_id, amount: M, reason: "Milestone cancelled" }` (request ID `rf:{milestoneId}`). Store `refundId`.
   3. `refund.accepted` or `refund.settled` → milestone `REFUNDED`. `refund.failed` → `REFUND_FAILED`.
3. **Wallet rail:** `POST /connected_account_transfers/create` to buyer CA for `M` (`cat:{milestoneId}:refund`). On `settled` → `REFUNDED`.
4. Offer terminal check: if all milestones are `REFUNDED`, the offer → `CANCELLED`; if all are terminal with some `PAID`, it → `COMPLETED`.

---

## F10. Wallet / profile

**UI:** `/wallet`

- **Balances** per currency (available, pending, total) from `GET /balances/current` (on behalf of the user's CA).
- **Escrow summary** from our DB: "Held for you (incoming as seller): $X" and "Held from you (as buyer): $Y".
- **Transactions** from `GET /balances/history` (on behalf of the user), shown with type, amount, and date. Map types like `TRANSFER`, `CHARGE`, `SPLIT`, `PAYOUT` to friendly labels.
- **Airwallex account card:** `acct_...` ID, status, and a "View raw" toggle (demo transparency).
- **Withdraw to bank:** `POST /api/wallet/withdrawals` creates a local USD transfer (`POST /api/v1/transfers/create`, `x-on-behalf-of` the user's CA) to a shared sandbox ACH beneficiary. The amount is checked against the available balance first.
- **Send to user:** `POST /api/wallet/sends` charges the sender's CA, waits until that charge is `SETTLED`, then creates a CA transfer to the recipient. If the transfer fails, the same amount is transferred back to the sender. The recipient must be a ready user and cannot be the revenue account or the sender.

---

## F11. Platform page (demo-only)

**UI:** `/platform` (optionally gated by `DEMO_ADMIN_KEY`)

- Platform account balances (`GET /balances/current`, no on-behalf header).
- Revenue CA balances (on behalf of the Revenue account), which shows the fee split accumulating.
- Recent webhooks (last 50) with name, object ID, processed status, and error.
- Stuck items: milestones in `RELEASING`/`REFUNDING` for more than 2 minutes, with **Retry** and **Sync** buttons.

---

## F12. Activity panel (per offer)

A collapsible panel on `/offers/[id]`, labelled **"Behind the scenes: Airwallex"**, shows:

- A timeline merging `airwallex_logs` (outbound calls) and `webhook_events` (inbound) for the offer, in chronological order.
- Each row shows method + path or event name, status, key IDs (`int_`, `spt_`, `rfd_`, `acct_`), and an expandable JSON view.

This is the main storytelling tool when demoing to technical audiences.
