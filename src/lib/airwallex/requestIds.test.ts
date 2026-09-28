import { describe, expect, it } from "vitest";
import {
  chargeRequestId,
  paymentIntentRequestId,
  refundRequestId,
  releaseSplitRequestId,
  revenueSplitRequestId,
  reverseSplitRequestId,
  sellerSplitRequestId,
  sellerTransferRequestId,
  welcomeCreditRequestId,
} from "@/lib/airwallex/requestIds";

const offerId = "a".repeat(24);
const milestoneId = "b".repeat(24);
const splitId = "spt_hkpd1k27vg1xc7u";

describe("request ids", () => {
  it("matches the documented patterns and stays within the API limit", () => {
    expect(paymentIntentRequestId(offerId, 1)).toBe(`pi:${offerId}:1`);
    expect(sellerSplitRequestId(milestoneId)).toBe(`fs:${milestoneId}:seller`);
    expect(revenueSplitRequestId(milestoneId)).toBe(`fs:${milestoneId}:rev`);
    expect(releaseSplitRequestId(splitId)).toBe(`fsr:${splitId}`);
    expect(reverseSplitRequestId(splitId)).toBe(`fsrev:${splitId}`);
    expect(refundRequestId(milestoneId)).toBe(`rf:${milestoneId}`);
    expect(chargeRequestId(offerId)).toBe(`ch:${offerId}`);
    expect(sellerTransferRequestId(milestoneId)).toBe(`cat:${milestoneId}:seller`);
    expect(welcomeCreditRequestId(offerId)).toBe(`welcome:${offerId}`);

    for (const id of [
      paymentIntentRequestId(offerId, 1),
      sellerSplitRequestId(milestoneId),
      chargeRequestId(offerId),
      welcomeCreditRequestId(offerId),
    ]) {
      expect(id.length).toBeLessThanOrEqual(50);
    }
  });

  it("rejects a scale request id over 50 characters", () => {
    expect(() => chargeRequestId("x".repeat(50))).toThrow(/1–50/);
  });
});
