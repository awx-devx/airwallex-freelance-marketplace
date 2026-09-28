import { readString } from "@/lib/airwallex/json";
import { extractAccountId, extractObject, verifyAirwallexSignature } from "@/lib/airwallex/webhooks";
import { connectDb } from "@/lib/db";
import { WebhookEvent } from "@/models/webhookEvent";
import { dispatchWebhook } from "@/services/webhookHandlers";

function duplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: unknown }).code === 11000;
}

function signatureOk(raw: string, request: Request): boolean {
  const timestamp = request.headers.get("x-timestamp");
  const signature = request.headers.get("x-signature");
  const secret = process.env.AIRWALLEX_WEBHOOK_SECRET?.trim();
  if (secret && verifyAirwallexSignature(raw, timestamp, signature, secret)) return true;
  // DEMO-ONLY: Sandbox web-app test events are signed with the client-secret-key header, not the endpoint secret.
  // PROD: Verify only with AIRWALLEX_WEBHOOK_SECRET.
  if (process.env.NODE_ENV === "production") return false;
  const testSecret = request.headers.get("client-secret-key");
  return Boolean(testSecret && verifyAirwallexSignature(raw, timestamp, signature, testSecret));
}

export async function POST(request: Request): Promise<Response> {
  const raw = await request.text();
  if (!signatureOk(raw, request)) {
    return new Response("invalid signature", { status: 400 });
  }

  let event: unknown;
  try {
    event = JSON.parse(raw) as unknown;
  } catch {
    return new Response("invalid payload", { status: 400 });
  }
  const eventId = readString(event, "id");
  const name = readString(event, "name");
  if (!eventId || !name) return new Response("invalid payload", { status: 400 });

  await connectDb();
  const object = extractObject(event);
  try {
    await WebhookEvent.create({
      eventId,
      name,
      accountId: extractAccountId(event),
      objectId: readString(object, "id"),
      payload: event,
      signatureValid: true,
      receivedAt: new Date(),
    });
  } catch (error) {
    if (!duplicateKey(error)) throw error;
    const existing = await WebhookEvent.findOne({ eventId });
    if (existing?.processedAt) return Response.json({ ok: true, duplicate: true });
  }

  try {
    const offerId = await dispatchWebhook(event);
    await WebhookEvent.updateOne(
      { eventId },
      { $set: { processedAt: new Date(), ...(offerId ? { relatedOfferId: offerId } : {}) }, $unset: { processingError: "" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed.";
    await WebhookEvent.updateOne({ eventId }, { $set: { processingError: message } });
  }
  return Response.json({ ok: true });
}

export const runtime = "nodejs";
