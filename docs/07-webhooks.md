# 07 — Webhooks

Webhooks are the source of truth for money state. UI actions request transitions; webhooks confirm them.

References: [Webhooks overview](https://www.airwallex.com/docs/developer-tools/webhooks/webhooks-overview.md), [Listen for webhook events](https://www.airwallex.com/docs/developer-tools/webhooks/listen-for-webhook-events.md), [Online payments events](https://www.airwallex.com/docs/developer-tools/webhooks/listen-for-webhook-events/online-payments.md), [CA transfer events](https://www.airwallex.com/docs/developer-tools/webhooks/listen-for-webhook-events/connected-account-transfers.md), [Charge events](https://www.airwallex.com/docs/developer-tools/webhooks/listen-for-webhook-events/charges.md), [Account events](https://www.airwallex.com/docs/developer-tools/webhooks/listen-for-webhook-events/account.md).

## Subscriptions

Configure one webhook URL in the sandbox web app (**Developer → Webhooks**): `https://<host>/api/webhooks/airwallex`. Subscribe to:

| Event | Why |
| --- | --- |
| `payment_intent.succeeded` | Card funding complete → create held splits |
| `payment_intent.payment_failed` | Card funding failed → offer back to `SENT` |
| `payment_intent.cancelled` | Abandoned PI → offer back to `SENT` |
| `funds_split.created` | Record split status (informational) |
| `funds_split.released` | Split release acknowledged |
| `funds_split.settled` | Split funds landed in destination CA → may mark milestone `PAID` |
| `funds_split.failed` | Release/split failed → `RELEASE_FAILED` |
| `refund.received` / `refund.accepted` / `refund.settled` / `refund.failed` | Card refund lifecycle |
| `charge.settled` / `charge.failed` / `charge.suspended` | Wallet funding lifecycle |
| `connected_account_transfer.settled` / `.failed` / `.suspended` | Welcome credit, wallet release, wallet refund |
| `account.active` / `account.action_required` / `account.suspended` | Connected account status |

Whether the sandbox web app lets you pick "funds split reversal" events is unconfirmed. If available, subscribe too.

## Verification

Headers: `x-timestamp` (Unix ms) and `x-signature` (HMAC-SHA256 hex of `timestamp + rawBody`, keyed by the webhook secret).

```ts
// src/lib/airwallex/webhooks.ts
import crypto from 'node:crypto';

export function verifyAirwallexSignature(rawBody: string, timestamp: string | null, signature: string | null, secret: string) {
  if (!timestamp || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(timestamp + rawBody).digest('hex');
  const a = Buffer.from(expected), b = Buffer.from(signature);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  // AIRWALLEX: tolerance is ours to choose; 5 minutes guards against replay.
  return Math.abs(Date.now() - Number(timestamp)) < 5 * 60 * 1000;
}
```

Gotchas from the Airwallex docs:

- Use the **raw** body string (`await req.text()`). Don't `JSON.parse` and re-stringify before hashing.
- Use `x-timestamp` exactly as received.
- **Test events** sent from the web app are signed with the secret in the `client-secret-key` header of the test payload, not your endpoint secret. `// DEMO-ONLY:` Accept that header only when `NODE_ENV !== 'production'`.
- Each webhook URL has its own secret.

## Route handler

```ts
// src/app/api/webhooks/airwallex/route.ts
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const raw = await req.text();
  const valid = verifyAirwallexSignature(raw, req.headers.get('x-timestamp'), req.headers.get('x-signature'), env.AIRWALLEX_WEBHOOK_SECRET);
  if (!valid) return new Response('invalid signature', { status: 400 });

  const evt = JSON.parse(raw);
  // Idempotency: unique index on eventId. Duplicate insert => already received.
  const stored = await WebhookEvent.insertIfNew({ eventId: evt.id, name: evt.name, payload: evt, signatureValid: true });
  if (!stored.isNew && stored.doc.processedAt) return Response.json({ ok: true, duplicate: true });

  try {
    await dispatchWebhook(evt);            // src/services/webhookHandlers.ts
    await stored.markProcessed();
  } catch (err) {
    await stored.markFailed(err);          // visible on /platform; sync can fix state
  }
  return Response.json({ ok: true });      // 200 so Airwallex doesn't hammer retries for our bugs
}
```

`// PROD:` Acknowledge fast and process asynchronously (queue). Alert on processing failures. Consider returning 5xx for transient DB errors so Airwallex retries.

## Payload shape

Airwallex events look like:

```json
{ "id": "evt_...", "name": "payment_intent.succeeded", "account_id": "acct_...", "data": { "object": { "id": "int_...", "status": "SUCCEEDED", "...": "..." } }, "created_at": "..." }
```

Shapes differ slightly across products. For example, some examples show `accountId` (camelCase) and `data` as the object itself for CA transfers. **Normalize** in one place:

```ts
function extractObject(evt: any) { return evt?.data?.object ?? evt?.data ?? {}; }
function extractAccountId(evt: any) { return evt.account_id ?? evt.accountId; }
```

Log the first real payload of each event type during the spike and adjust the normalizer.

## Handler map (`src/services/webhookHandlers.ts`)

| Event | Lookup | Action |
| --- | --- | --- |
| `payment_intent.succeeded` | `payments.paymentIntentId = obj.id` (fallback: `obj.metadata.offerId`) | `release.onFundingSucceeded(offerId)` |
| `payment_intent.payment_failed` / `.cancelled` | same | payment `FAILED`/`CANCELLED`; offer → `SENT` if still `AWAITING_PAYMENT` |
| `funds_split.created` / `.released` / `.settled` / `.failed` | `milestones.release.{seller,revenue}Split.splitId = obj.id` | Update split status; `release.maybeMarkPaid(offerId, milestoneId)` on settled; `RELEASE_FAILED` on failed |
| `refund.*` | `milestones.release.refund.refundId = obj.id` (fallback: `obj.metadata.milestoneId`) | Update refund status; `REFUNDED` on accepted/settled; `REFUND_FAILED` on failed |
| `charge.settled` / `.failed` / `.suspended` | `payments.chargeId = obj.id` | Wallet funding success/failure |
| `connected_account_transfer.*` | Welcome credit (`request_id` prefix `welcome:`), or milestone `release.*Transfer.transferId` | Update transfer; `maybeMarkPaid` / `REFUNDED` |
| `account.*` | `users.airwallex.accountId` | Update `accountStatus` |
| anything else | – | Store only |

All handlers are **idempotent** and **monotonic**: they never move a status backwards (for example, a late `funds_split.released` after `SETTLED` is ignored). Implement with a status rank map plus conditional updates.

## Ordering and races

- Webhooks can arrive **out of order** and **more than once**. Status rank plus idempotency handle both.
- The **return page / sync** and the **webhook** may process the same PI success concurrently. `release.onFundingSucceeded` claims the transition with a conditional update (`payments.status: PENDING → SUCCEEDED`). Only the winner creates splits. Deterministic `request_id`s make even a double split-create safe (`duplicate_request` → retrieve existing).
- Split IDs are only known after `funds_splits/create` returns. A `funds_split.created` webhook may arrive before we've saved the ID. The handler falls back to `obj.metadata.milestoneId` / `obj.metadata.share` to find the right milestone.

## Local development

Airwallex can't reach `localhost`. Options:

1. **Tunnel:** `cloudflared tunnel --url http://localhost:3000` (or `ngrok http 3000`), then register the public URL in the sandbox web app. Update it whenever the tunnel URL changes.
2. **No tunnel:** rely on **sync** (`POST /api/offers/[id]/sync`). The offer page auto-polls while anything is pending, so every flow still completes; you just won't see webhook rows in the activity panel.
3. **Replay:** the Airwallex web app can re-trigger webhook events ([View and re-trigger](https://www.airwallex.com/docs/developer-tools/webhooks/view-and-re-trigger-webhook-events.md)), which is useful for testing idempotency.
