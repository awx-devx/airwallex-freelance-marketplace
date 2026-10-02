import { redact } from "./redact";

export class AirwallexError extends Error {
  readonly status: number;
  readonly code: string;
  readonly traceId: string | null;
  readonly details: unknown;
  readonly body: unknown;

  constructor(
    status: number,
    code: string,
    message: string,
    traceId: string | null,
    details: unknown,
    body: unknown,
  ) {
    super(message);
    this.name = "AirwallexError";
    this.status = status;
    this.code = code;
    this.traceId = traceId;
    this.details = details;
    this.body = body;
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      status: this.status,
      code: this.code,
      message: this.message,
      traceId: this.traceId,
      details: redact(this.details),
      body: redact(this.body),
    };
  }
}

export function isDuplicateRequest(error: unknown): error is AirwallexError {
  if (!(error instanceof AirwallexError)) return false;
  if (error.code === "duplicate_request") return true;
  // Connected-account transfers report a reused request_id as invalid_argument, not duplicate_request.
  return /request_id '.+' has been used in the past/i.test(error.message);
}

export function formatUnknownError(error: unknown): string {
  if (error instanceof AirwallexError) {
    const lines = [`Airwallex ${error.status} ${error.code}: ${error.message}`];
    if (error.traceId) lines.push(`trace: ${error.traceId}`);
    const extra = error.details ?? error.body;
    if (extra !== undefined) lines.push(JSON.stringify(redact(extra), null, 2));
    return lines.join("\n");
  }
  return error instanceof Error ? error.message : String(error);
}
