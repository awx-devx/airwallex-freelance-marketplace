import { ZodError } from "zod";
import type { ErrorCode, ErrorDTO } from "@/contracts/common";
import { AirwallexError } from "@/lib/airwallex/errors";

export class HttpError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(status: number, code: ErrorCode, message: string, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.name = code;
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export class Unauthenticated extends HttpError {
  constructor(message = "Sign in to continue.") {
    super(401, "UNAUTHENTICATED", message);
  }
}

export class Forbidden extends HttpError {
  constructor(message = "You can't do that.") {
    super(403, "FORBIDDEN", message);
  }
}

export class NotFound extends HttpError {
  constructor(message = "Not found.") {
    super(404, "NOT_FOUND", message);
  }
}

export class InvalidState extends HttpError {
  constructor(message: string) {
    super(409, "INVALID_STATE", message);
  }
}

export class InsufficientBalance extends HttpError {
  constructor(message = "Your wallet balance is too low.") {
    super(409, "INSUFFICIENT_BALANCE", message);
  }
}

export class EmailTaken extends HttpError {
  constructor() {
    super(409, "EMAIL_TAKEN", "That email is already in use.", { email: ["That email is already in use."] });
  }
}

export class InvalidCredentials extends HttpError {
  constructor() {
    super(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
  }
}

export class ProvisioningIncomplete extends HttpError {
  constructor(message = "Finish setting up your account first.") {
    super(409, "PROVISIONING_INCOMPLETE", message);
  }
}

export function zodFieldErrors(error: ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".");
    errors[path] ??= [];
    errors[path].push(issue.message);
  }
  return errors;
}

export function validationFailed(error: ZodError): HttpError {
  return new HttpError(422, "VALIDATION_FAILED", "Check the highlighted fields.", zodFieldErrors(error));
}

function errorResponse(status: number, error: ErrorDTO["error"]): Response {
  return Response.json({ error }, { status });
}

export function toErrorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return errorResponse(error.status, {
      code: error.code,
      message: error.message,
      fieldErrors: error.fieldErrors,
    });
  }

  if (error instanceof AirwallexError) {
    return errorResponse(502, {
      code: "AIRWALLEX_ERROR",
      message: error.message,
      airwallex: {
        code: error.code,
        traceId: error.traceId ?? undefined,
      },
    });
  }

  console.error(error);
  const databaseDown = error instanceof Error && error.name === "MongooseServerSelectionError";
  return errorResponse(500, {
    code: "INTERNAL",
    message: databaseDown ? "Couldn't reach MongoDB. Start the database, then try again." : "Something went wrong.",
  });
}
