# Sandbox spike findings

Raw Airwallex responses are written to `scripts/spike/out/` (gitignored). This file is updated by the spike scripts. Copy resolved behaviour into [docs/13-open-questions-and-risks.md](../../docs/13-open-questions-and-risks.md) after a run.

`npm run spike:all` runs scripts 01–05. Pay the PaymentIntent with `npm run spike:checkout`, then run `npm run spike:funds-split` and `npm run spike:refund`. `npm run spike:webhooks` is a listener.

## 01 — Auth (R8)

<!-- 01 -->

Login returned `expires_at` 2026-09-26T15:11:56.000Z (1800s from now). The client refreshes from that timestamp, minus 60s.

Authenticated `GET` without `x-api-version`: /api/v1/account → 200.

Same call with `x-api-version: 2026-08-21`: /api/v1/account → 200.

Response headers containing version/trace: {"unversioned":{"x-awx-trace-id":"19fcace954fc4606ae561c2c8b2bec27","x-b3-traceid":"19fcace954fc4606ae561c2c8b2bec27"},"pinned":{"x-awx-trace-id":"b0ee422323ed4381b49b5abece4cb5ad","x-b3-traceid":"b0ee422323ed4381b49b5abece4cb5ad"}}.

AIRWALLEX_PLATFORM_ACCOUNT_ID is unset, so it was not compared.

The client sends `x-api-version` only when `AIRWALLEX_API_VERSION` is set. Leave it unset until this result is accepted.

<!-- /01 -->

## 02 — Connected account (R1, R2)

<!-- 02 -->

Seller `acct_2IQ6UX0BNrC79Qnmedypjg` status `ACTIVE` using payload `minimal`.

Revenue `acct_JDqJyyRgO5i0ff8L1KuCrg` status `ACTIVE` using payload `minimal`.

Submit attempts:

```

minimal create: CREATED
minimal submit: SUBMITTED
minimal force: ACTIVE

minimal create: CREATED
minimal submit: SUBMITTED
minimal force: ACTIVE

```

Tier-like fields on the seller account: customer_agreements.terms_and_conditions.service_agreement_type=FULL.

Top-level seller keys: account_details, created_at, customer_agreements, id, identifier, metadata, nickname, primary_contact, status, view_type.

Connected accounts and sandbox simulation/update_status are enabled (R1, R2).

<!-- /02 -->

## 03 — Balances and CA transfer (R1, R6)

<!-- 03 -->

CA Transfer `tr_NlTAFCXuNLas9w-Wlm2ldg` to `acct_2IQ6UX0BNrC79Qnmedypjg` for $50.00 ended `SETTLED`.

Platform USD available: 9999950. Seller USD available (x-on-behalf-of): 50.

Seller balance history source_type values: TRANSFER.

Seller balance history transaction_type values: DC_CREDIT.

`balances/current` is called with and without `x-on-behalf-of`. History is filtered to USD.

<!-- /03 -->

## 04 — Charge (R1, R5)

<!-- 04 -->

Charge `ch_LD74NPpYMc-5tqI5k260hA` with `source: acct_2IQ6UX0BNrC79Qnmedypjg` ended `SETTLED`.

The create response echoed source as `acct_2IQ6UX0BNrC79Qnmedypjg`.

No separate authorization or consent request was required before `charges/create`.

<!-- /04 -->

## 05 — PaymentIntent (R1, R3 setup, R12)

<!-- 05 -->

A platform PaymentIntent with no `connected_account_id` succeeds. `int_sgpv8c85lhmpsatjvtz` was created for 100 USD and, after Hosted Payment Page payment, retrieved as `SUCCEEDED`. `mor_enabled` was `false` (that flag is Airwallex's tax Merchant of Record product, not the platform-owned gateway model).

`connected_account_id` is still rejected for both the individual seller `acct_2IQ6UX0BNrC79Qnmedypjg` and the business account `acct_PZCj0eyONbe6g5OT-RuSKA`:

```
400 validation_error: The connected account is not enabled for payment acceptance.
```

Platform capabilities `payments_visa` and `payments_mastercard` are `PENDING`, not `ENABLED`. Sandbox checkout still captured the test card.

`POST /api/v1/pa/payment_intents/{id}/confirm` with a card number returns `400`: this account is not enabled for native API access. Checkout has to go through Drop-in or the Hosted Payment Page.

A `400 validation_error` on create still consumes the `request_id`.

<!-- /05 -->

## Checkout (R12)

<!-- checkout -->

Drop-in from `@airwallex/components-sdk` mounts only when `createElement` is taken from `init().payments`, not from the package root. After that fix it mounted. The Hosted Payment Page (`redirectToCheckout`) accepted test card `4035 5010 0000 0008` for `int_sgpv8c85lhmpsatjvtz`. The browser return is provisional; retrieve showed `SUCCEEDED` (latest attempt `CAPTURE_REQUESTED`).

<!-- /checkout -->

## 06 — Held funds splits (R3, R4, R10, R11)

<!-- 06 -->

Held splits work when the destination is a force-activated **business** account, including when the PaymentIntent has no `connected_account_id`.

- `spt_sgpvvgp9jhmpsdhq04m` amount `60.00` destination `acct_PZCj0eyONbe6g5OT-RuSKA` `auto_release: false` stayed `CREATED` for 20s. Business available balance stayed `0`.
- Release returned `RELEASED`. About 30s later it was still `RELEASED`, not `SETTLED`. Business available stayed `0`. Platform USD `reserved_amount` became `60`.
- A second held split `spt_sgpvvgp9jhmpsdhus73` amount `30.00` to the same business stayed `CREATED`.

Individual destinations are not eligible on this platform. Split to seller `acct_2IQ6UX0BNrC79Qnmedypjg` (and the same with `auto_release: true`) returned:

```
400 validation_error: Individual account funds split is only supported for the model 2.1
```

A business account that is not yet ACTIVE returns `The destination account hasn't passed KYC yet.` Force-activate after `submit` clears that.

No `FEE` or `SPLIT` rows appeared in platform balance history during this window. Splits of 90 USD against a 100 USD payment were accepted.

<!-- /06 -->

## 07 — Reversal and refund (R7)

<!-- 07 -->

Partial refunds succeed while splits are still outstanding. Reversal does not, until the destination actually holds the funds.

- Refund `30` USD before reversing the `CREATED` 30 USD split: `rfd_sgpvwkrsthmpsf4929n_atjvtz` status `RECEIVED`. The split stayed `CREATED`.
- Reversal of that `CREATED` split, including a 1 USD retry: `400 validation_error: Insufficient funds in USD currency.` Destination available was `0`. Platform available was about `9999900`, with `reserved_amount` `60`.
- A second refund of `30` USD also returned `RECEIVED`.
- Reversal of the `RELEASED` (not yet `SETTLED`) 60 USD split failed with the same insufficient-funds error.

So a refund does not require a reversal, and a reversal cannot claw back a split that has not settled to the connected account. The `CREATED` split was still `CREATED` after the refund (dangling).

<!-- /07 -->

## 08 — Webhooks (R9)

<!-- 08 -->

Pending. Run `npm run spike:webhooks` with `AIRWALLEX_WEBHOOK_SECRET` set and a tunnel pointed at the listener.

<!-- /08 -->

## Not probed here (R13, R14)

Shared guest accounts (R13) and the sandbox amount ceiling (R14) are not API calls these scripts make. R13 stays a product mitigation (conditional updates, guest pool). R14 stays the $9,000 offer cap until a live call rejects a larger amount.
