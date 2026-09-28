# 08 — Seeding

`npm run seed` (`tsx --env-file=.env.local scripts/seed.ts`) prepares a demo environment that anyone can log in to immediately.

## Goals

1. **Idempotent.** Safe to run repeatedly. Existing seed users and their Airwallex accounts are reused, never duplicated.
2. **Real.** Every seeded account is a real, `ACTIVE` sandbox connected account with a real wallet balance. Seeded "active contracts" are backed by real Airwallex money movement.
3. **Varied.** The demo shows offers and milestones in every interesting state right away.

## What gets seeded

`npm run seed` creates a real sandbox connected account for **every row below**, using the same `BUSINESS` payload as sign-up ([03 §7](./03-airwallex-integration.md#7-connected-account-provisioning)). That is 1 fee account + 8 seed users. The spike's individual accounts are not these accounts and must not be reused: Funds Splits to individual accounts fail on this sandbox.

### 1. Service fee account (Revenue)

| Field | Value |
| --- | --- |
| Name | `Platform Revenue` |
| Email | `revenue@demo.test` (no login; `kind: REVENUE`) |
| Airwallex | `BUSINESS` CA created → submitted → forced `ACTIVE`. No welcome credit. `business_name` is `Platform Revenue`. |

Its `acct_...` is saved to `platform_settings.revenueAccountId`. Every milestone's fee split (`revenueMinor`) goes here, on both the card rail and the wallet rail. Seed creates this account before the users, because later offer funding transfers the fee into it.

### 2. Seed users

All use password `SEED_PASSWORD` (default `demo1234`). All are `kind: SEED`. Those marked guest are in the **guest pool**.

| Name | Email | Headline | Guest pool | Typical role |
| --- | --- | --- | --- | --- |
| Maya Chen | `maya@demo.test` | Brand & identity designer | ✓ | Seller |
| Leo Okafor | `leo@demo.test` | Full-stack developer | ✓ | Seller |
| Priya Nair | `priya@demo.test` | Content strategist & copywriter | ✓ | Seller |
| Sam Rivera | `sam@demo.test` | Founder, Rivera Coffee Co. | ✓ | Buyer |
| Hannah Weiss | `hannah@demo.test` | Marketing lead, Northwind | ✓ | Buyer |
| Diego Alvarez | `diego@demo.test` | Product manager, Lumen Apps | ✓ | Buyer |
| Aiko Tanaka | `aiko@demo.test` | Motion designer | ✓ | Both |
| Omar Haddad | `omar@demo.test` | Indie game studio owner | ✓ | Both |

Each goes through account provisioning (see [05 F1](./05-user-flows.md#f1-sign-up)): create a `BUSINESS` connected account, submit, force `ACTIVE`, then the **welcome credit** (`WELCOME_CREDIT_AMOUNT`, default $5,000). Seed users do not get a welcome offer — that offer is only created for a new `REGULAR` signup, and it needs one of these sellers to already be `READY`. Buyers and Both get an extra seed top-up of $20,000 so wallet-rail demos never run dry. If a user already has an `ACTIVE` account id stored, provisioning reuses it. It does not create a second account. A `--hard` reset bumps `seedVersion`, and the next seed uses a new identifier (`seed-maya-v2`) so the old connected account is left behind.

### 3. Seed offers

Designed so **every guest-pool user has something to do** as both buyer and seller when they log in.

| # | Seller → Buyer | Title | Milestones | Seeded state | How it's funded |
| --- | --- | --- | --- | --- | --- |
| 1 | Maya → Sam | Coffee brand identity | Moodboard $300 · Logo $700 · Brand kit $500 | `SENT` (incoming for Sam) | – |
| 2 | Leo → Hannah | Landing page build | Design $800 · Build $1,500 · Launch $400 | `SENT` | – |
| 3 | Priya → Diego | Launch blog series | 4 × $250 | `SENT` | – |
| 4 | Maya → Hannah | Social media templates | Set A $400 · Set B $400 | `ACTIVE`: A **SUBMITTED** (links), B FUNDED | Wallet rail |
| 5 | Leo → Sam | Shopify store fixes | Audit $300 · Fixes $900 | `ACTIVE`: Audit **PAID**, Fixes SUBMITTED | Wallet rail |
| 6 | Aiko → Omar | Game trailer | Storyboard $600 · Animation $1,800 · Final cut $600 | `ACTIVE`: Storyboard PAID, Animation FUNDED, Final cut FUNDED | Wallet rail |
| 7 | Omar → Aiko | Pixel art asset pack | Characters $500 · Tiles $500 | `SENT` | – |
| 8 | Priya → Omar | Store page copy | Copy $350 | `COMPLETED` (PAID) | Wallet rail |
| 9 | Diego → Maya | App icon refresh | Icon $450 | `CANCELLED` (REFUNDED) | Wallet rail |

**Why the wallet rail for seeds?** Card payments must be confirmed in a browser through the Drop-in element. The Native card API needs PCI DSS, which sandbox accounts don't have by default. Charges and CA Transfers are fully server-side, so the seed script can drive real funding, release, and refund.

For card-rail examples, the demo presenter accepts one of the `SENT` offers live.

`// DEMO-ONLY:` The seed script moves real sandbox money by calling the escrow service with the seller/buyer as actors, bypassing the UI.

### Welcome offer templates

When a **new user signs up**, provisioning creates one offer from a random `SEED` seller to them, chosen from templates like:

| Template | Milestones |
| --- | --- |
| Personal website | Wireframes $200 · Design $400 · Build $600 |
| Logo design | Concepts $250 · Final files $350 |
| Pitch deck | Outline $150 · Slides $450 |
| Product explainer video | Script $300 · Animation $900 |

The offer is `SENT`, `isWelcomeOffer: true`, and shows a small "Demo" badge: "This offer was generated so you can try the flow".

## Algorithm

```text
seed():
  connect Mongo
  assert Airwallex login works (fail fast with a helpful message)
  ensure platform_settings

  revenue = upsertUser(revenue spec)          // kind REVENUE, no login
  provision(revenue, { welcomeCredit: false }) // BUSINESS CA; the service-fee destination
  save revenueAccountId

  for spec in SEED_USERS:                    // all 8 rows in the table above
    user = upsertUser(spec)                  // by email; keep existing passwordHash if unchanged
    provision(user)                          // BUSINESS CA; resumable; no-op if READY
    if spec.extraTopUp: caTransfer(user, spec.extraTopUp, request_id = `seedtopup:{userId}:{seedVersion}`)

  for spec in SEED_OFFERS:
    if offer with seedKey exists: skip       // offers carry `seedKey` for idempotency
    offer = offers.createAndSend(...)
    if spec.state beyond SENT:
      funding.payFromWallet(offer)           // charge buyer CA
      waitFor(() => charge settled)          // poll retrieve; max 30s
      apply milestone actions in order: submitDelivery / approve / refund
      waitFor terminal transfer statuses

  print summary table: users, acct ids, balances, offers by state
```

`scripts/seed.ts` currently runs through the user loop and the buyer top-up. The offer loop waits for the wallet rail.

Add a `seedKey` field to offers (sparse unique index) for seed idempotency.

## Reset

`npm run reset` (`tsx --env-file=.env.local scripts/reset.ts`)

- Deletes Mongo demo data: `offers`, `payments`, `activity`, `webhook_events`, `airwallex_logs`, and **non-seed** users.
- **Does not delete Airwallex connected accounts.** Sandbox CAs can't be simply deleted (offboarding is a separate workflow). Seed users are kept, so their `acct_...` IDs are reused on the next seed.
- Then run `npm run seed` again. Seed users' wallet balances will reflect previous activity. That's fine; top-ups are generous.

Flags:

- `--hard`: also delete seed users from Mongo. The next seed creates **new** CAs (old ones are orphaned in the sandbox). Use only if a seed account is broken.
- `--yes`: skip the confirmation prompt.

## Seed data files

- `scripts/seed-data/users.ts`: seed user specs.
- `scripts/seed-data/offers.ts`: seed offer specs with target states and delivery links (use real-looking but harmless URLs, for example `https://www.figma.com/file/demo-...`, `https://github.com/example/...`).
- `scripts/seed-data/welcome-templates.ts`: welcome offer templates (also imported by provisioning).
- `scripts/seed-data/identity-fixture.ts`: `// DEMO-ONLY:` fake KYC data used for every connected account.
