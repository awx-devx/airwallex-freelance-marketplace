# 09 — UI Kit and Pages

Design direction: **editorial fintech.** Paper and ink surfaces, a single violet accent, and no marketing pages. Titles and amounts use a serif; labels, controls, and body copy stay a sans. Corners are small (4px), not pills. Cards are hairline borders with no drop shadow. Dark mode is warm black, ivory type, and muted jewel status colours. **Light and dark** ship together; extra themes are more token sets on the same variables. See [Themes](#themes) and [Responsiveness](#responsiveness). Layouts are designed for desktop and must stay usable on a phone (375px).

Data access, hooks, and state rules are in [14-frontend-architecture.md](./14-frontend-architecture.md). API shapes are in [06-api-routes.md](./06-api-routes.md).

## 1. Tooling

| Concern | Choice |
| --- | --- |
| Styling | Tailwind CSS v4 with CSS-variable design tokens (below) |
| Primitives | **shadcn/ui** (copied into `src/components/ui`, Radix-based). We own and restyle the code. |
| Icons | `lucide-react` |
| Toasts | `sonner` (via the shadcn `Sonner` wrapper) |
| Forms | `react-hook-form` + `@hookform/resolvers/zod` |
| Font | Inter for UI; Newsreader for headings and amounts (`next/font/google`). Amounts also use `tabular-nums` and stay on one line. |
| Class merging | `clsx` + `tailwind-merge` (`cn()` helper, shadcn default) |
| Variants | `class-variance-authority` (shadcn default) |

### Themes

A theme is a complete set of the CSS variables in [§2](#2-design-tokens-srcappglobalscss). Components never read a theme name and never hardcode hex colours. They use semantic tokens (`bg-background`, `text-foreground`, `bg-primary`, `text-success`, and so on), so a new theme is a new variable block, not a restyle of components.

| Theme id | How it is applied | Notes |
| --- | --- | --- |
| `light` | `:root` (no extra class). Default. | Values in the token table below. |
| `dark` | class `dark` on `<html>` | Same variable names. Must include `--surface`, `--success`, `--warning`, `--danger`, `--info`, and the violet `--primary` / `--ring`, not only the shadcn defaults. |
| later ids | an extra class on `<html>`, for example `theme-contrast` | Registered next to light and dark. If the palette is dark, also include the `dark` class so existing `dark:` utilities keep working. |

Rules:

- **Built-in pair is light and dark.** Both are reviewed on `/dev/ui-kit` (a theme control next to the width control). A component isn't done until it is readable in both.
- **Preference** is `light`, `dark`, or `system` (follow `prefers-color-scheme`). Store it in `localStorage` under `theme`. Default is `system`. Apply the class on `<html>` before paint so the first frame isn't the wrong theme.
- **Use `next-themes`** with `attribute="class"`. It matches the existing `@custom-variant dark (&:is(.dark *))` and the `.dark` block in `globals.css`.
- **Toasts follow the resolved theme.** Don't pin Sonner to `theme="light"`.
- **Status colours are part of every theme.** `success`, `warning`, `danger`, and `info` must stay distinguishable on that theme's background. Primary stays the violet accent in both built-in themes.
- **Adding a theme later:** add the id to one registry (label, class names, whether it is a dark palette), add the CSS variable block, and add it to the UI-kit theme control. No component changes.

### Responsiveness

Every screen and every UI-kit component is built to work at **375, 768, and 1024+**. Tailwind is mobile-first: unprefixed classes are the phone layout; `sm` / `md` / `lg` add the wider layout. Don't ship a desktop-only page and "fix mobile later".

| Width | Breakpoint | What it represents |
| --- | --- | --- |
| 375px | default (no prefix) | Phone. Required. Nothing may overflow the viewport. |
| 768px | `md` | Tablet. Two columns only when both columns stay readable. |
| 1024px | `lg` | Desktop. Side-by-side layouts (create-offer form + summary, platform balances, UI-kit nav) start here. |

Rules:

- **No page-level horizontal scroll.** A wide table or JSON viewer scrolls inside its own `overflow-x-auto` container. Flex/grid children that truncate need `min-w-0`.
- **Money stays on one line** (`whitespace-nowrap` + tabular nums). Long titles truncate with the full text available on hover or in the detail view.
- **Primary actions stay visible** on a phone (pay, approve, submit delivery, send offer). Secondary actions can move into a menu. Action rows wrap or stack; the main button is full width below `sm` when it sits next to other buttons.
- **Multi-column pages stack below `lg`.** Create-offer summary, platform balance pair, and the UI-kit sidebar become a single column. Sticky side panels are not sticky on small screens.
- **Top bar** below `md`: logo mark and a menu button. Wallet, New offer, theme, and account actions live in a side panel. The Powered by Airwallex notch stays on the bottom edge at every width. Don't give the bar a second row.
- **Dialogs** are `w-full` with side margin below `sm`, and a max width on desktop. They must not exceed the viewport, and the body scrolls if the content is tall.
- **Forms** (milestone editor, delivery links, login) stack fields vertically below `md`. Don't put amount, date, and title on one row on a phone.
- **Touch targets** for buttons, icon buttons, tabs, and menu items are at least 44px tall below `md`.
- **Home** already switches the three offer sections to tabs below `lg` (`?tab=`). Other long pages follow the same idea: don't stack three full lists on a phone if tabs fit.
- **Review before done.** New components go on `/dev/ui-kit` and are checked with the width control (375 / 768 / 1024 / full). New screens are checked at 375 and 1024 in the browser, including empty, loading, and error states.

## 2. Design tokens (`src/app/globals.css`)

Values below are the **light** theme (`:root`). Dark and any later theme override the same names. See [Themes](#themes).

| Token | Value | Use |
| --- | --- | --- |
| `--background` | `#FBF9F4` | Paper. Cards and sheets |
| `--surface` | `#F3EFE6` | App canvas behind cards |
| `--foreground` | `#1C1917` | Ink. Body text |
| `--muted-foreground` | `#78716C` | Secondary text |
| `--border` | `#E4DDD0` | Hairline borders, dividers |
| `--primary` | `#612FFF` | Primary buttons, links, focus ring (close to Airwallex's brand violet) |
| `--primary-foreground` | `#FFFFFF` | |
| `--success` | `#16A34A` | Paid, completed |
| `--warning` | `#D97706` | Pending, awaiting |
| `--danger` | `#DC2626` | Failed, destructive |
| `--info` | `#2563EB` | Held in escrow |
| `--radius` | `0.25rem` | Cards, inputs, buttons. Avatars, switches, and progress stay fully round. |

Dark theme (class `dark` on `<html>`): three warm steps, canvas then sheet then card. Type is ivory. Status colours are muted jewels, not neon. Primary stays `#612FFF`.

| Token | Value | Use |
| --- | --- | --- |
| `--surface` | `#0A0908` | Warm black canvas |
| `--background` | `#16140F` | Sheet |
| `--card` | `#1C1914` | Card, lifted off the sheet |
| `--foreground` | `#F6F1E7` | Ivory |
| `--muted-foreground` | `#9A9084` | Secondary text |
| `--border` | `#322C24` | Warm hairline |
| `--primary` | `#612FFF` | |
| `--primary-foreground` | `#FFFFFF` | |
| `--success` | `#8FB59A` | |
| `--warning` | `#C9A36A` | |
| `--danger` | `#C98B84` | |
| `--info` | `#8AA8C4` | |

Type scale: `text-xs` 12 / `text-sm` 14 (default UI text, Inter) / `text-base` 16 / `text-lg` 18 / `text-xl` 20 / `text-3xl` 30 (page titles, Newsreader). Amounts use Newsreader, larger than the surrounding text, with tabular figures (`money` utility). Weights: 400 body, 500 labels and serif headings. Spacing on Tailwind's 4px scale; cards use `p-5` and a hairline border (no shadow), page gutters `px-6`, max content width `max-w-5xl`. Menus and popovers may still use a soft shadow.

### Status → visual mapping (single source: `src/components/domain/status.ts`)

| Status(es) | Label | Tone | Icon |
| --- | --- | --- | --- |
| `SENT` | Sent | neutral | `Send` |
| `PENDING_FUNDING` | Awaiting funding | neutral | `Clock` |
| `AWAITING_PAYMENT` | Awaiting payment | warning, spinner | `Loader2` |
| `ACTIVE` | Active | info | `CircleDot` |
| `FUNDED` | Held in escrow | info | `Lock` |
| `SUBMITTED` | Awaiting review | violet | `Inbox` |
| `CHANGES_REQUESTED` | Changes requested | warning | `RotateCcw` |
| `RELEASING` | Releasing… | warning, spinner | `Loader2` |
| `PAID` | Paid | success | `CheckCircle2` |
| `COMPLETED` | Completed | success | `CheckCircle2` |
| `REFUNDING` | Refunding… | warning, spinner | `Loader2` |
| `REFUNDED` | Refunded | neutral, muted | `Undo2` |
| `CANCELLED` / `DECLINED` / `WITHDRAWN` | Cancelled / Declined / Withdrawn | neutral, muted | `XCircle` |
| `RELEASE_FAILED` / `REFUND_FAILED` | Release failed / Refund failed | danger | `AlertTriangle` |

Once every card funds split on a `RELEASING` milestone is `RELEASED`, the pill is **Released** (info, `CheckCircle2`, no spinner) instead of Releasing…. **Paid** still waits for `SETTLED`.

## 3. UI kit inventory

Every component below must appear on the **UI kit demo page** (§4) in all listed variants and states.

### Primitives (`src/components/ui`)

| Component | Variants / states to show |
| --- | --- |
| `Button` | `primary`, `secondary`, `outline`, `ghost`, `destructive`, `link` × sizes `sm`/`md`/`lg` × `disabled`, `loading` (spinner + label kept), with leading icon, icon-only |
| `Input`, `Textarea` | default, placeholder, disabled, invalid (with error text), with prefix (`$`) |
| `MoneyInput` | empty, valid (`450.00` → shows "$450.00"), invalid (`4.5.0`), below minimum |
| `Label` + `FormField` | label, hint, error message, required marker |
| `Select` | default, disabled, invalid |
| `Combobox` (user picker base) | empty, typing/loading, results, no results |
| `Checkbox`, `Switch` | on/off/disabled |
| `DateInput` | native `type="date"` styled; empty/filled/invalid |
| `Card` | plain, with header/footer, interactive (border darkens on hover) |
| `Badge` | neutral, info, success, warning, danger, outline |
| `Tabs` | 2–4 tabs, with counts |
| `Dialog` | basic; **`ConfirmDialog`** (destructive variant with required reason textarea) |
| `DropdownMenu` | user menu example |
| `Tooltip` | text, rich (fee breakdown) |
| `Alert` / `Callout` | info, success, warning, danger; with action button |
| `Skeleton` | text lines, card, table rows |
| `Spinner` | sm/md/lg; inline in text |
| `Avatar` | initials + color, sizes sm/md/lg, `AvatarGroup` |
| `Table` | header, rows, empty row, loading rows, right-aligned money column |
| `Progress` | 0%, 40%, 100% |
| `Separator`, `KeyValueList` | key/value pairs (for IDs, amounts) |
| `CopyButton` | idle → "Copied" feedback |
| `CodeBlock` / `JsonViewer` | collapsed/expanded JSON, long strings wrap |
| `EmptyState` | icon, title, description, action |
| `ErrorState` | message, retry button, optional Airwallex code/trace ID |
| `Stepper` / `Checklist` | pending, active (spinner), done, failed (used by `/welcome`) |
| `Timeline` | items with icon, actor, relative time |
| `Toaster` | buttons that fire success/error/info/loading→success toasts |

### Layout (`src/components/layout`)

| Component | Notes |
| --- | --- |
| `AppShell` | Compact `DemoBanner` above the top bar, then content; handles client-side auth/provisioning redirects |
| `TopBar` | Sticky. From `md`: logo mark, `WalletChip`, **New offer**, theme toggle, user `DropdownMenu` (Wallet, Platform, UI kit in dev, Log out). Below `md`: logo mark and a menu button. The panel holds New offer, Wallet (with the balance), Platform, UI kit in dev, the theme toggle, and Log out. A centered **Powered by Airwallex** tab hangs below the bar at every width, with square corners so it clears the controls |
| `DemoBanner` | Compact strip **above** the top bar (so it never sits under the Airwallex notch). Sandbox notice + test card; guest variant; mock-mode variant ("Mock data — no backend") |
| `PageHeader` | Title, subtitle, right-side actions, optional back link |
| `Section` | Titled group with optional count and action |

### Domain components (`src/components/domain`)

| Component | Props (from DTOs) | States to show on the demo page |
| --- | --- | --- |
| `Money` | `MoneyDTO`, `signed?`, `muted?` | positive, negative (signed), zero, large |
| `StatusPill` | `status` | **every** status in the table above |
| `UserChip` | `UserSummaryDTO`, `subtitle?` | with/without headline |
| `WalletChip` | `BalanceDTO` or loading | loading, value, error (dash) |
| `FeeBreakdown` | `amount` + `PublicConfigDTO` or `FeeBreakdownDTO`; `variant: 'inline' \| 'card' \| 'tooltip'` | $1,000 example, $10 minimum, rounding case ($333.33), zero-reserve config |
| `OfferCard` | `OfferSummaryDTO` | incoming (Review), buying active with progress, selling with next action, completed, cancelled, welcome badge |
| `OfferHeader` | `OfferDTO` | each offer status; buyer vs seller view |
| `OfferActionBar` | `OfferDTO.allowedActions` | each combination (accept/decline, withdraw, continue/cancel payment, cancel remaining, none) |
| `EscrowSummary` | `OfferDTO.totals` | all held, partly released, partly refunded, completed |
| `MilestoneCard` | `MilestoneDTO`, `viewerRole` | **matrix:** every `MilestoneStatus` × buyer/seller (rendered from fixtures), including pending spinner, failed with error + retry, timed-out sync |
| `DeliveryForm` | `onSubmit` | empty, 1 link, 5 links (max), invalid URL, submitting |
| `DeliveryView` | `DeliveryDTO` | with note, without note, with review comment |
| `ReviewActions` | approve / request changes | idle, approving (loading), request-changes dialog open |
| `EscrowLegList` | `EscrowLegDTO[]` | split legs, transfer legs, refund leg, statuses |
| `ActivityTimeline` | `ActivityItemDTO[]` | empty, typical offer history |
| `AirwallexActivityPanel` | `AirwallexEventDTO[]` | collapsed, expanded, API call row (2xx and 4xx), webhook row (processed/failed), JSON expanded |
| `BalanceTable` | `BalanceDTO[]` | one currency, multiple, loading, empty |
| `TransactionList` | `TransactionDTO[]` | inflow/outflow rows, load more, empty |
| `AccountCard` | `WalletDTO.account` | active, action required |
| `TestCardHint` | `PublicConfigDTO.testCards` | copy buttons |
| `MockCardForm` | session | idle, submitting, declined error, success |
| `DropInCheckout` | session | real mode only; on the demo page show a placeholder explaining it needs a real PaymentIntent |
| `UserPicker` | uses `useUserSearch` | built on `Combobox` |
| `MilestoneEditor` | RHF field array | 1 row, several rows, row errors, max reached |
| `ProvisioningChecklist` | `MeDTO.provisioning` | each step, failed with retry |

## 4. UI kit demo page (`/dev/ui-kit`)

Purpose: build and review every component in isolation, **before** pages exist, and catch regressions later. It replaces Storybook for this project.

- Route: `src/app/dev/ui-kit/page.tsx` (client). Enabled when `NODE_ENV !== 'production'` **or** `NEXT_PUBLIC_ENABLE_UI_KIT=true`; otherwise `notFound()`. `// DEMO-ONLY:` internal tool.
- Layout: left sticky nav with anchors (`#buttons`, `#status-pill`, `#milestone-card`, ...), content on the right. Each section has a title, a one-line usage note, and a grid of variants with a small caption under each ("Button / destructive / loading").
- Sections in order:
  1. **Tokens:** color swatches (with hex), type scale, money specimen, radius, spacing, elevation
  2. **Primitives** (in the order of the table above)
  3. **Layout:** `TopBar`, `DemoBanner` variants, `PageHeader`
  4. **Domain:** in the order of the table above; `MilestoneCard` gets a full status × role matrix
  5. **Composites:** a full `OfferScreen` rendered from a fixture (no network) in 3 states (incoming, active mid-way, completed)
  6. **Interactions:** buttons that trigger toasts, open dialogs, and simulate a pending → paid transition on a `MilestoneCard` (local state timer)
- Data: import fixtures directly from `src/lib/api/mock/fixtures.ts` (typed DTOs). The kit page doesn't call hooks, except `UserPicker`, which uses the mock transport.
- Controls at the top: theme (`light` / `dark` / `system`, next to the width control), container width (375 / 768 / 1024 / full), toggle `viewerRole` (buyer/seller), "show loading", and "show errors".
- Acceptance: every component and state in §3 is visible, keyboard focus rings are visible, and nothing overflows at 375px.

## 5. Pages

Each page is a thin `page.tsx` that renders a client **screen** component. Standard states for every data-driven section: **loading** (skeletons matching the final layout), **empty** (`EmptyState` with a next step), and **error** (`ErrorState` with retry calling `refetch`).

### `/login` — `LoginScreen` (public)
- **Header:** logo mark (links home) and the theme toggle. Shared with `/signup`.
- **Data:** `useDemoAccounts()`, `usePublicConfig()`
- **Mutations:** `useLogin()`, `useGuestLogin()`
- **UI:** email/password form (RHF), big secondary **Continue as guest**, then a link to sign up. Below that, a "Demo accounts" list (`UserChip`, role, **Log in as**, password `demo1234` shown).
- **Errors:** `INVALID_CREDENTIALS` shown inline under the form.

### `/signup` — `SignupScreen` (public)
- **Mutations:** `useSignup()` → `/welcome`
- **UI:** name, email, password, headline. Note: "We'll create a sandbox Airwallex account for you. No email verification."
- **Errors:** `EMAIL_TAKEN` on the email field; `fieldErrors` mapped.

### `/welcome` — `WelcomeScreen`
- **Data:** `useMe({ refetchInterval: 1500 while not READY/FAILED })`
- **Mutations:** `useRunProvisioning()` fired on mount and by **Retry**
- **UI:** `ProvisioningChecklist` (create account → activate → $5,000 credit → first offer), `acct_...` with `CopyButton` once known, **Go to dashboard** when `READY`.

### `/` (Home) — `HomeScreen`
- **Data:** `useOffers('incoming')`, `useOffers('buying')`, `useOffers('selling')`, `useWallet()` (for the chip; shared with `TopBar`)
- **UI:** `PageHeader` ("Hi Sam"), then three `Section`s of `OfferCard`s: Incoming offers, Buying, Selling. On narrow screens, sections become `Tabs` (`?tab=` in URL).
- **Empty:** Incoming: "No offers yet. They'll appear here when someone sends you one." Selling: CTA **Create your first offer**.

### `/offers/new` — `CreateOfferScreen`
- **Data:** `usePublicConfig()`; `useUserSearch(q)` inside `UserPicker`
- **Mutations:** `useCreateOffer()` → navigate to `/offers/[id]`
- **UI:** two columns. The left has the form (`UserPicker`, title, description, `MilestoneEditor`). The right has a sticky summary card with total, "You'll receive", and `FeeBreakdown variant="card"` (live, computed client-side with `fees.breakdown` + config).
- **Validation:** client zod (same schema as server); server `fieldErrors` mapped onto fields.

### `/offers/[id]` — `OfferScreen`
- **Data:** `useOffer(id)`, `useOfferActivity(id)`, `useOfferAirwallexEvents(id, { enabled: panelOpen })`, `useOfferSync(id, offer)`
- **Mutations:** `useOfferAction(id)`, `useMilestoneAction(id)`
- **UI (top to bottom):**
  1. `OfferHeader` (title, `StatusPill`, seller → buyer, total, short ref)
  2. `OfferActionBar` driven by `offer.allowedActions` (Accept & pay navigates to `/offers/[id]/pay`)
  3. `EscrowSummary`
  4. `MilestoneCard` list, each driven by `milestone.allowedActions`:
     - `SUBMIT_DELIVERY` → `DeliveryForm`
     - `APPROVE` / `REQUEST_CHANGES` → latest `DeliveryView` + `ReviewActions`
     - `CANCEL` → overflow menu item → `ConfirmDialog` ("$X will be refunded to the buyer")
     - `RETRY` → button on failed/stuck milestones
     - pending, release not accepted yet → spinner + "Waiting for Airwallex…" + **Sync** (and "Still waiting" after the 60s poll)
     - card splits already `RELEASED` → **Released**, no spinner. The seller is told it was released to them; the buyer is told it was released to the seller. Settlement can take a day, and either of them can leave. **Sync** stays. **Paid** still waits for `SETTLED`
     - `PAID` → "Paid to Maya · 25 Sep" + `EscrowLegList`
  5. `ActivityTimeline`
  6. `AirwallexActivityPanel` (collapsed by default; "Behind the scenes: Airwallex")
- **Errors:** `404` → "Offer not found"; `403` → "You're not part of this offer".

### `/offers/[id]/pay` — `PayScreen`
- **Data:** `useOffer(id)`, `usePublicConfig()`, `useWallet()` (wallet tab)
- **Mutations:** `useStartCardPayment(id)` (on mount of the card tab), `usePayFromWallet(id)`, `useCancelPayment(id)`
- **UI:** order summary (milestones + total; payee "Platform, held in escrow for Maya"); `Tabs` for **Card** and **Wallet** (`?method=`).
  - Card tab: `DropInCheckout` (real) or `MockCardForm` (mocks), plus `TestCardHint`
  - Wallet tab: balance, **Pay $X from wallet** (disabled with reason if insufficient)
- Explainer: "Your payment is held by Airwallex and released to the seller milestone by milestone when you approve."
- Guard: if `ACCEPT_AND_PAY`/`CONTINUE_PAYMENT` isn't in `allowedActions`, redirect to `/offers/[id]`.

### `/offers/[id]/pay/return` — `PayReturnScreen`
- **Mutations:** `useReconcilePayment(id)` on mount; then `useOfferSync` if still `AWAITING_PAYMENT`
- **UI:** spinner → success ("Payment received, $X held in escrow", **View contract**) or failure ("Payment not completed", **Try again**).

### `/wallet` — `WalletScreen`
- **Data:** `useWallet()`, `useWalletTransactions()` (infinite)
- **UI:** `AccountCard`, `BalanceTable`, escrow summary (held as buyer / incoming as seller), `TransactionList` with **Load more**. Withdraw and Send dialogs. Send stays disabled, with "Choose who to send to.", until a recipient is picked.

### `/platform` — `PlatformScreen` (demo-only)
- **Data:** `usePlatformOverview()`, `usePlatformWebhooks()` (both poll every 5s)
- **Mutations:** `useMilestoneAction(offerId).retry`, sync
- **UI:** platform vs Revenue account balances side by side, fees collected, stuck items table (Retry/Sync), recent webhooks table.

## 6. Copy guidelines

- Say **"held in escrow"** (not "pending") for funded milestones.
- Say **"released"** when the buyer approves, and **"paid"** when Airwallex confirms settlement.
- Always show the money split explicitly. It's the point of the demo.
- Never imply real money: include "sandbox" or "demo" on payment screens.
- Buttons state the outcome and amount: "Approve & release $300.00" (the milestone amount), not "Approve". The seller's net share is shown next to it in the breakdown.
