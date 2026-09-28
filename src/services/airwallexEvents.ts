import type { AirwallexEventDTO } from "@/contracts/activity";
import { AirwallexEventSchema } from "@/contracts/activity";
import { connectDb } from "@/lib/db";
import { AirwallexLog } from "@/models/airwallexLog";
import { WebhookEvent } from "@/models/webhookEvent";
import type { UserDocument } from "@/models/user";
import { getOffer } from "@/services/offers";

export async function listAirwallexEvents(user: UserDocument, offerId: string): Promise<AirwallexEventDTO[]> {
  const offer = await getOffer(user, offerId);
  await connectDb();
  const [logs, hooks] = await Promise.all([
    AirwallexLog.find({ relatedOfferId: offer.id }).sort({ createdAt: 1 }),
    WebhookEvent.find({ relatedOfferId: offer.id }).sort({ receivedAt: 1 }),
  ]);
  const events: AirwallexEventDTO[] = [
    ...logs.map((log) =>
      AirwallexEventSchema.parse({
        id: log._id.toString(),
        source: "API_CALL",
        at: log.createdAt.toISOString(),
        method: log.method,
        path: log.path,
        status: log.status,
        durationMs: log.durationMs,
        onBehalfOf: log.onBehalfOf,
        requestBody: log.requestBody,
        responseBody: log.responseBody,
        errorCode: log.errorCode,
      }),
    ),
    ...hooks.map((hook) =>
      AirwallexEventSchema.parse({
        id: hook._id.toString(),
        source: "WEBHOOK",
        at: hook.receivedAt.toISOString(),
        name: hook.name,
        objectId: hook.objectId,
        processed: Boolean(hook.processedAt),
        processingError: hook.processingError,
        payload: hook.payload,
      }),
    ),
  ];
  return events.sort((a, b) => a.at.localeCompare(b.at));
}
