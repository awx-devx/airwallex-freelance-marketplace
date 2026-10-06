# 11 — Setup and Runbook

## 1. Airwallex sandbox setup (one-time)

1. **Create a sandbox account** via self-serve sign-up ([Sandbox environment](https://www.airwallex.com/docs/developer-tools/sandbox-environment.md)). It is auto-activated, with Payments onboarding approved, Hosted Payment Page and cards enabled, and wallets pre-funded (10,000,000 each in USD/EUR/GBP/CNY). Avoid registering as CN (Payments auto-onboarding is skipped for CN).
2. **Request platform capabilities from Airwallex.** This is the long pole. Ask your Airwallex contact / Support to enable on the sandbox account:
   - **Connected accounts** (Scale / platform APIs: `accounts/create`, `simulation/accounts/*`)
   - **Payments for Platforms: Airwallex payment gateway, "collect payments directly"** model (PaymentIntent `connected_account_id`)
   - **Funds Split**, including **manual release** (`auto_release: false`) and **Funds Split Reversals**
   - **Charges** and **Connected Account Transfers**
   - Confirm which **connected account tier** (ledger / withdrawal / full) sandbox CAs will be, and that they can be Funds Split destinations.
   - Ask about any **maximum hold period** for unreleased Funds Splits.

   The spike already confirmed connected accounts, charges, transfers, and Funds Splits to **business** accounts. This sandbox is gateway **model 2.2**. Individual split destinations need **model 2.1** ([03 §2](./03-airwallex-integration.md#gateway-models-21-and-22)). `connected_account_id` on PaymentIntent create is still rejected, so the backend omits it until payment acceptance is enabled on the seller account.
3. **API keys:** Developer → API keys. Copy the **Client ID** and **API key** into `.env.local`.
4. **Webhooks:** Developer → Webhooks → add `https://<public-host>/api/webhooks/airwallex`. Subscribe to the events in [07-webhooks.md](./07-webhooks.md#subscriptions). Copy the **secret** into `AIRWALLEX_WEBHOOK_SECRET`.
5. Note the **platform account ID** (`acct_...`) into `AIRWALLEX_PLATFORM_ACCOUNT_ID`.

## 2. Local setup

```bash
# prerequisites: Node 22.22+ or 24.15+, a MongoDB (local or Atlas) for a real demo
cp .env.example .env.local        # fill in Airwallex + Mongo values
npm install
npm run spike:all                 # B0 sandbox checks (see 12-implementation-plan.md)
npm run seed                      # business CA for the fee account, then one per seed user, then seed offers
npm run dev                       # http://localhost:3000
```

Webhooks locally (optional but recommended):

```bash
cloudflared tunnel --url http://localhost:3000
# register https://<random>.trycloudflare.com/api/webhooks/airwallex in the sandbox web app
```

Without a tunnel, the app falls back to polling via the sync endpoint.

### npm scripts

| Script | Does |
| --- | --- |
| `dev` / `build` / `start` | Next.js |
| `seed` | `tsx scripts/seed.ts` |
| `reset` | `tsx scripts/reset.ts` (add `-- --hard --yes` for a full wipe) |
| `spike:all` | Scripts 01–05 against the sandbox. Continues into 06–07 only if the PaymentIntent is already `SUCCEEDED`. |
| `spike:auth` | Login, `expires_at`, and the `x-api-version` header (R8). |
| `spike:account` | Connected account create, submit, and sandbox activation (R1, R2). |
| `spike:balances` | CA Transfer and `balances/current` + `history` with `x-on-behalf-of` (R6). |
| `spike:charge` | Charge a connected account (`source: acct_...`) (R5). |
| `spike:payment-intent` | Create a PaymentIntent and print `client_secret` (R3 setup). |
| `spike:checkout` | Serve `scripts/spike/checkout.html` so you can pay that intent (R12). |
| `spike:funds-split` | Held splits, optional wait (`SPIKE_HOLD_MINUTES`), then release one (R3, R4, R10, R11). |
| `spike:refund` | Reversal and partial refund on the spike splits (R7). |
| `spike:webhooks` | Local webhook listener. Needs `AIRWALLEX_WEBHOOK_SECRET` and a tunnel (R9). |
| `test` | Unit tests (fees, money, webhook signature, state transitions) |
| `lint` / `typecheck` | – |

## 3. Deploying the demo (Replit)

The repo includes a [`.replit`](../.replit) file. Replit imports the GitHub repo and runs `npm run build`, then `npm run start` on `0.0.0.0` and `PORT` (mapped from local 3000 to external 80). Mongo stays on **MongoDB Atlas**. Replit has no MongoDB.

1. **Atlas.** Create a cluster and a database user. Set `MONGODB_URI` to that connection string. Allow Replit’s egress in Atlas Network Access (`0.0.0.0/0` is the usual sandbox choice).
2. **Import.** Open `https://replit.com/github/awx-devx/airwallex-freelance-marketplace`, or use [replit.com/import](https://replit.com/import) and choose the GitHub repo.
3. **Secrets, in two places.** Add every variable in the workspace **Secrets** tool and again under the deployment’s **Secrets**. Workspace secrets are not copied into a deployment. `NEXT_PUBLIC_*` must be set before the deployment **build**; Next inlines them at build time. Boot fails without `MONGODB_URI` and a `SESSION_SECRET` of 32+ characters.
4. **Values for a real demo.**
   - `NEXT_PUBLIC_API_MOCKS=false` (a production build refuses mocks unless `ALLOW_MOCKS_IN_PROD=true`)
   - `NEXT_PUBLIC_AIRWALLEX_ENV=demo`
   - `APP_URL=https://<slug>.replit.app` (the published host, no trailing slash)
   - `AIRWALLEX_API_BASE=https://api.sandbox.airwallex.com` plus `AIRWALLEX_CLIENT_ID`, `AIRWALLEX_API_KEY`, `AIRWALLEX_WEBHOOK_SECRET`, and `AIRWALLEX_PLATFORM_ACCOUNT_ID` from [§1](#1-airwallex-sandbox-setup-one-time)
   - `DEMO_ADMIN_KEY` set to a secret. A public deploy must set it. When it is empty, `/platform` and `GET /api/platform/*` are open to any signed-in user.
   - The remaining demo keys in [`.env.example`](../.env.example) can stay at their defaults
5. **Publish.** The file defaults to Autoscale (`cloudrun`), which can scale to zero and drop a webhook during a cold start. Choose a **Reserved VM** when you publish if webhooks must land while the app is idle. The in-app **Sync** action still recovers a missed webhook.
6. **Webhook.** In the Airwallex sandbox, set the webhook URL to `https://<slug>.replit.app/api/webhooks/airwallex`. Use the published host, not the `*.replit.dev` editor URL. Subscribe to the events in [07-webhooks.md](./07-webhooks.md#subscriptions).
7. **Seed from your machine**, not inside the Replit container. `npm run seed` reads `.env.local`, which is not on Replit. Point `.env.local` at the same Atlas URI and Airwallex keys, then run `npm run seed`. The seed talks to Airwallex directly.

## 4. Demo script (about 5 minutes)

1. **Landing / login:** click **Continue as guest** and land as, for example, Sam Rivera (buyer).
2. **Home:** point out the incoming offer from Maya ("Coffee brand identity", 3 milestones, $1,500).
3. **Review offer:** show the milestone breakdown and fee transparency.
4. **Accept & pay:** Drop-in, card `4035 5010 0000 0008`. Open **Behind the scenes** to show the PaymentIntent (no `connected_account_id` on this sandbox) and the held Funds Splits to the seller and Revenue business accounts.
5. **Funded:** all milestones show **Awaiting release**. The panel shows `payment_intent.succeeded` and 6 Funds Splits created with `auto_release: false`.
6. **Switch to seller:** log out, then **Log in as Maya** from the demo accounts list. Submit delivery links for Milestone 1.
7. **Switch back to Sam:** approve Milestone 1. The panel shows two `release` calls, then `funds_split.settled`.
8. **Maya's wallet:** balance up by $270 (90% of $300). **/platform:** Revenue account up by $24.
9. **Refund:** as Sam, cancel Milestone 3 and show the reversal + refund and `refund.accepted`.
10. **Wallet rail (optional):** accept Omar's pixel-art offer as Aiko using **Pay from wallet** to show Charges + CA Transfers.

## 5. Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| `401 unauthorized` on every call | Wrong client ID/API key, or keys from production instead of sandbox. Check `AIRWALLEX_API_BASE`. |
| `accounts/create` → 403 / `operation_not_supported` | Connected accounts not enabled on the platform account. Contact Airwallex (setup step 2). |
| `submit` fails with `field_required` | The business payload is missing `business_person_details[0].identifications.primary`. Use `accountCreateBody` in `identity-fixture.ts`. Force-activate only after status is `SUBMITTED`. |
| Funds Split → `Individual account funds split is only supported for the model 2.1` | This sandbox is model 2.2, so the destination must be `BUSINESS`. Individual sellers need the platform moved to model 2.1. See [03 §2](./03-airwallex-integration.md#gateway-models-21-and-22). |
| `simulation/.../update_status` fails | Account must be in `SUBMITTED` first. A just-submitted account can reject activation for a few seconds; provisioning retries for 20s. |
| Funds Split create → `operation_not_supported` | Funds Split not enabled, **or** created after settlement. Check timing and account config. Set `ENABLE_WALLET_RAIL=true` and use the wallet rail as the fallback. |
| Funds Split create → validation error on destination | Destination CA not `ACTIVE` / not KYC-passed, or not eligible tier. |
| Release → `invalid_status_for_operation` | Split already released or `auto_release` was true. |
| Refund `FAILED` | Insufficient refundable funds in that currency, or the payment is disputed. Check platform balance. |
| Webhooks not arriving | Tunnel URL changed; wrong URL path; not subscribed to the event. Use **Sync** meanwhile. |
| Signature invalid | Body was parsed before hashing; wrong secret (each URL has its own); test event signed with `client-secret-key`. |
| Drop-in doesn't render | Using legacy `airwallex-payment-elements`; wrong `env` (must be `demo` for sandbox); listeners attached before `mount()`. |
| Milestone stuck in `RELEASING` | Webhook missed. Click **Sync** or use `/platform` → Retry. |
