import { describe, expect, it } from "vitest";
import { AirwallexError, isDuplicateRequest, isRequestPending } from "./errors";

describe("isDuplicateRequest", () => {
  it("matches the payment-acceptance duplicate_request code", () => {
    const error = new AirwallexError(400, "duplicate_request", "request_id already used", null, undefined, undefined);
    expect(isDuplicateRequest(error)).toBe(true);
  });

  it("matches a connected-account transfer that says the request_id was used", () => {
    const error = new AirwallexError(
      400,
      "invalid_argument",
      "request_id 'seedtopup:6abac1793ebef3e7a3dba04a:1' has been used in the past.  please use a different request_id for this request",
      null,
      undefined,
      { code: "invalid_argument", source: "request_id" },
    );
    expect(isDuplicateRequest(error)).toBe(true);
  });

  it("leaves other invalid_argument errors alone", () => {
    const error = new AirwallexError(400, "invalid_argument", "amount is required", null, undefined, undefined);
    expect(isDuplicateRequest(error)).toBe(false);
  });

  it("treats duplicate_request_id and a 409 request_pending as the same in-flight call", () => {
    const duplicate = new AirwallexError(400, "duplicate_request_id", "request_id already used", null, undefined, undefined);
    const payout = new AirwallexError(400, "request_id_duplicate", "request_id already used", null, undefined, undefined);
    const pending = new AirwallexError(409, "request_pending", "request_id is pending", null, undefined, undefined);
    expect(isDuplicateRequest(duplicate)).toBe(true);
    expect(isDuplicateRequest(payout)).toBe(true);
    expect(isDuplicateRequest(pending)).toBe(true);
    expect(isRequestPending(pending)).toBe(true);
    expect(isRequestPending(duplicate)).toBe(false);
  });
});
