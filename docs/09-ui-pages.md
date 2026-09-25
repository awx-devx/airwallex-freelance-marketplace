# 09 — UI Pages and Components

Design direction: **bare-bones but clean.** Neutral palette, one accent color, generous whitespace, system font or Inter, Tailwind utility classes, and at most a handful of shared components. No marketing site.

## Global layout

- **Top bar:** app name (left); wallet balance chip, **New offer** button, and user menu (right). The user menu has Wallet, Platform (demo), and Log out.
- **Demo banner** (thin, dismissible): "Sandbox demo: no real money. Test card 4035 5010 0000 0008." If logged in as a guest: "You're exploring as Sam Rivera (shared demo account)."
- **Toasts** for action results. **Status pills** with consistent colors:

| Status | Pill |
| --- | --- |
| SENT / PENDING_FUNDING | gray |
| AWAITING_PAYMENT / RELEASING / REFUNDING | amber, with a spinner |
| FUNDED ("Held in escrow") | blue |
| SUBMITTED ("Awaiting review") | violet |
| CHANGES_REQUESTED | orange |
| PAID / COMPLETED | green |
| REFUNDED / CANCELLED / DECLINED / WITHDRAWN | slate, struck through |
| *_FAILED | red |

## Pages

### `/login`
Email/password form. A big secondary **Continue as guest** button. Below it, a "Demo accounts" list (name, headline, and a **Log in as** button). Link to sign up.

### `/signup`
Name, email, password, and headline (optional). Note: "We'll create a sandbox Airwallex account for you."

### `/welcome`
Provisioning checklist with live progress (polls `/api/me/provisioning`):
1. Creating your Airwallex connected account
2. Activating (sandbox simulation)
3. Adding $5,000 demo credit
4. Preparing your first offer

Shows `acct_...` once created. Shows **Retry** on failure. **Go to dashboard** when ready.

### `/` (Home)
- **Incoming offers:** cards (seller avatar/name, title, total, milestone count, sent date, **Review**).
- **Buying:** active/completed contracts with progress (`$300 of $1,500 released`) and the next action.
- **Selling:** active/completed contracts plus sent offers, with next action.
- Empty states link to **New offer**.

### `/offers/new`
- Buyer search combobox.
- Title, description (textarea).
- Milestones editor (rows: title, amount, due date, expandable description; add/remove/move).
- **Sticky summary card:** total, "You'll receive", platform fee, and the split breakdown (Revenue account vs processing reserve), updated live using the same `fees.breakdown` function (shared module).
- **Send offer** button.

### `/offers/[id]`
The primary page. Content depends on viewer role and status.

- **Header:** title, status pill, seller → buyer, total, short ref (`OF-7K2Q`).
- **Action bar** (context-sensitive):
  - Buyer + SENT: **Accept & pay**, **Decline**
  - Seller + SENT: **Withdraw**
  - Buyer + AWAITING_PAYMENT: **Continue payment**, **Cancel payment**
  - ACTIVE: **Cancel remaining** (confirm dialog)
- **Milestones list:** each is a card with title, amount, due date, status pill, breakdown tooltip, and a role-aware action area:
  - Seller + FUNDED/CHANGES_REQUESTED: delivery form (links + note)
  - Buyer + SUBMITTED: delivery links, note, **Approve & release $X**, **Request changes**
  - RELEASING/REFUNDING: spinner, "Waiting for Airwallex…", **Sync** link
  - PAID: "Paid to Maya on 25 Sep" with a link to the split ID
  - Delivery history (collapsed)
- **Escrow summary box:** Held $X · Released $Y · Refunded $Z.
- **Timeline** (from `activity`).
- **Behind the scenes: Airwallex** panel (collapsible): merged API calls and webhooks, with JSON viewers.

### `/offers/[id]/pay`
- Order summary (milestones and total). Payee is shown as "Platform (held in escrow for Maya)".
- Tabs: **Card** (Drop-in element mounted in `<div id="dropIn" />`, test card hint box with copy buttons) and **Wallet** (balance, **Pay from wallet**).
- Explanation: "Your payment is held by Airwallex and released to the seller milestone by milestone when you approve."

### `/offers/[id]/pay/return`
Calls reconcile, then shows either "Payment received — $X held in escrow" with a checkmark and **View contract**, or "Payment not completed" with **Try again**.

### `/wallet`
- Account card: `acct_...`, status, "Airwallex connected account (sandbox)".
- Balances table (currency, available, pending, total).
- Escrow summary (as buyer: held; as seller: incoming).
- Transactions table (date, type, description/reference, amount ±).
- Stretch: **Withdraw** and **Send** buttons (modals).

### `/platform` (demo-only)
- Platform balances and Revenue account balances side by side, with a "Fees collected" total from our DB.
- Stuck items with **Retry** / **Sync**.
- Recent webhooks table.

## Shared components

| Component | Notes |
| --- | --- |
| `StatusPill` | Maps status → label and color |
| `Money` | Formats minor units + currency (`Intl.NumberFormat`) |
| `FeeBreakdown` | Uses `fees.breakdown`, used in create form, milestone tooltip, and pay page |
| `MilestoneCard` | Role-aware actions |
| `DeliveryForm` | Link inputs with URL validation |
| `DropInCheckout` | Client component wrapping `@airwallex/components-sdk` |
| `AirwallexActivityPanel` | Timeline of logs + webhooks with JSON viewer |
| `PendingPoller` | Calls `/api/offers/[id]/sync` every 3s while pending, then `router.refresh()` |
| `DemoBanner` | Sandbox notice + guest notice |

## Copy guidelines

- Say **"held in escrow"** (not "pending") for funded milestones.
- Say **"released"** when the buyer approves, and **"paid"** when Airwallex confirms settlement.
- Always show the money split explicitly. It's the point of the demo.
- Never imply real money: include "sandbox" or "demo" on payment screens.
