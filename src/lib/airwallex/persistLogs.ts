import { Types } from "mongoose";
import { setAirwallexLogger, type AirwallexLogEntry } from "@/lib/airwallex/client";
import { readString } from "@/lib/airwallex/json";
import { connectDb } from "@/lib/db";
import { AirwallexLog } from "@/models/airwallexLog";

const MAX_BODY_CHARS = 8_000;

function trimBody(value: unknown): unknown {
  if (value === undefined) return undefined;
  const json = JSON.stringify(value);
  if (json.length <= MAX_BODY_CHARS) return value;
  return { truncated: true, preview: json.slice(0, MAX_BODY_CHARS) };
}

function objectId(value: string | undefined): Types.ObjectId | undefined {
  if (!value || !Types.ObjectId.isValid(value)) return undefined;
  return new Types.ObjectId(value);
}

async function persist(entry: AirwallexLogEntry): Promise<void> {
  await connectDb();
  const requestBody = trimBody(entry.requestBody);
  await AirwallexLog.create({
    method: entry.method,
    path: entry.path,
    onBehalfOf: entry.onBehalfOf ?? undefined,
    requestId: readString(entry.requestBody, "request_id"),
    requestBody,
    status: entry.status,
    responseBody: trimBody(entry.responseBody),
    errorCode: entry.status >= 400 ? readString(entry.responseBody, "code") : undefined,
    durationMs: entry.durationMs,
    relatedOfferId: objectId(entry.relatedOfferId),
    relatedMilestoneId: objectId(entry.relatedMilestoneId),
    relatedUserId: objectId(entry.relatedUserId),
  });
}

/** Records each Airwallex call on `airwallex_logs`. A log failure does not fail the API call. */
export function installAirwallexLogPersistence(): void {
  setAirwallexLogger((entry) => {
    void persist(entry).catch((error: unknown) => {
      console.error("airwallex_logs insert failed", error instanceof Error ? error.message : error);
    });
  });
}
