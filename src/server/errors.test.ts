import { describe, expect, it } from "vitest";
import { AirwallexError } from "@/lib/airwallex/errors";
import { EmailTaken, toErrorResponse } from "@/server/errors";

describe("toErrorResponse", () => {
  it("maps typed service errors", async () => {
    const response = toErrorResponse(new EmailTaken());
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "EMAIL_TAKEN",
        message: "That email is already in use.",
        fieldErrors: { email: ["That email is already in use."] },
      },
    });
  });

  it("maps Airwallex failures to 502", async () => {
    const response = toErrorResponse(new AirwallexError(400, "validation_error", "Rejected.", "trace-1", null, null));
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "AIRWALLEX_ERROR",
        message: "Rejected.",
        airwallex: { code: "validation_error", traceId: "trace-1" },
      },
    });
  });

  it("says when MongoDB is not running", async () => {
    const error = new Error("connect ECONNREFUSED");
    error.name = "MongooseServerSelectionError";
    const response = toErrorResponse(error);
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INTERNAL", message: "Couldn't reach MongoDB. Start the database, then try again." },
    });
  });

  it("hides unexpected errors", async () => {
    const response = toErrorResponse(new Error("disk full"));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: { code: "INTERNAL", message: "Something went wrong." },
    });
  });
});
