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
3. **API keys:** Developer → API keys. Copy the **Client ID** and **API key** into `.env.local`.
4. **Webhooks:** Developer → Webhooks → add `https://<public-host>/api/webhooks/airwallex`. Subscribe to the events in [07-webhooks.md](./07-webhooks.md#subscriptions). Copy the **secret** into `AIRWALLEX_WEBHOOK_SECRET`.
5. Note the **platform account ID** (`acct_...`) into `AIRWALLEX_PLATFORM_ACCOUNT_ID`.

## 2. Local setup

```bash
# prerequisites: Node 20+, a MongoDB (local or Atlas)
cp .env.example .env.local        # fill in Airwallex + Mongo values
npm install
npm run spike:all                 # Phase-0 sandbox checks (see 12-implementation-plan.md)
npm run seed                      # creates Revenue CA, seed users, seed offers
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
| `spike:*` | Individual sandbox experiments in `scripts/spike/` |
| `test` | Unit tests (fees, money, webhook signature, state transitions) |
| `lint` / `typecheck` | – |

## 3. Deploying the demo

1. MongoDB Atlas cluster, then set `MONGODB_URI`.
2. Vercel project, then set all env vars (`APP_URL` = production URL).
3. Update the webhook URL in the Airwallex sandbox web app to the Vercel URL.
4. Run `npm run seed` locally against the production `MONGODB_URI` (the seed talks to Airwallex directly; no deployed endpoint needed).

## 4. Demo script (about 5 minutes)

1. **Landing / login:** click **Continue as guest** and land as, for example, Sam Rivera (buyer).
2. **Home:** point out the incoming offer from Maya ("Coffee brand identity", 3 milestones, $1,500).
3. **Review offer:** show the milestone breakdown and fee transparency.
4. **Accept & pay:** Drop-in, card `4035 5010 0000 0008`. Open **Behind the scenes** to show the PaymentIntent created with `connected_account_id`.
5. **Funded:** all milestones show **Held in escrow**. The panel shows `payment_intent.succeeded` and 6 Funds Splits created with `auto_release: false`.
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
| `submit` fails with validation errors | Fixture identity data missing a mandatory field for the chosen country. Adjust `identity-fixture.ts` (the spike logs the error details). |
| `simulation/.../update_status` fails | Account must be in `SUBMITTED` first. |
| Funds Split create → `operation_not_supported` | Funds Split not enabled, **or** created after settlement. Check timing and account config. Set `ENABLE_WALLET_RAIL=true` and use the wallet rail as the fallback. |
| Funds Split create → validation error on destination | Destination CA not `ACTIVE` / not KYC-passed, or not eligible tier. |
| Release → `invalid_status_for_operation` | Split already released or `auto_release` was true. |
| Refund `FAILED` | Insufficient refundable funds in that currency, or the payment is disputed. Check platform balance. |
| Webhooks not arriving | Tunnel URL changed; wrong URL path; not subscribed to the event. Use **Sync** meanwhile. |
| Signature invalid | Body was parsed before hashing; wrong secret (each URL has its own); test event signed with `client-secret-key`. |
| Drop-in doesn't render | Using legacy `airwallex-payment-elements`; wrong `env` (must be `demo` for sandbox); listeners attached before `mount()`. |
| Milestone stuck in `RELEASING` | Webhook missed. Click **Sync** or use `/platform` → Retry. |
