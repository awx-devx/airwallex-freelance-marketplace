import { describe, expect, it } from "vitest";
import {
  cancelledCheckoutRefundRequestId,
  chargeRequestId,
  paymentIntentCancelRequestId,
  paymentIntentRequestId,
  refundRequestId,
  releaseSplitRequestId,
  refundTransferRequestId,
  revenueSplitRequestId,
  revenueTransferRequestId,
  reverseSplitRequestId,
  sellerSplitRequestId,
  sellerTransferRequestId,
  seedTopUpRequestId,
  sendChargeRequestId,
  sendReturnRequestId,
  sendTransferRequestId,
  welcomeCreditRequestId,
  withdrawalRequestId,
} from "@/lib/airwallex/requestIds";

const offerId = "a".repeat(24);
const milestoneId = "b".repeat(24);
const splitId = "spt_hkpd1k27vg1xc7u";

describe("request ids", () => {
  it("matches the documented patterns and stays within the API limit", () => {
    expect(paymentIntentRequestId(offerId, 1)).toBe(`pi:${offerId}:1`);
    expect(paymentIntentCancelRequestId(offerId)).toBe(`picancel:${offerId}`);
    expect(paymentIntentCancelRequestId(offerId).length).toBeLessThanOrEqual(64);
    expect(sellerSplitRequestId(milestoneId)).toBe(`fs:${milestoneId}:seller`);
    expect(revenueSplitRequestId(milestoneId)).toBe(`fs:${milestoneId}:rev`);
    expect(releaseSplitRequestId(splitId)).toBe(`fsr:${splitId}`);
    expect(reverseSplitRequestId(splitId)).toBe(`fsrev:${splitId}`);
    expect(refundRequestId(milestoneId)).toBe(`rf:${milestoneId}`);
    expect(cancelledCheckoutRefundRequestId(offerId)).toBe(`rf:cancel:${offerId}`);
    expect(cancelledCheckoutRefundRequestId(offerId).length).toBeLessThanOrEqual(64);
    expect(chargeRequestId(offerId)).toBe(`ch:${offerId}`);
    expect(sellerTransferRequestId(milestoneId)).toBe(`cat:${milestoneId}:seller`);
    expect(revenueTransferRequestId(milestoneId)).toBe(`cat:${milestoneId}:rev`);
    expect(refundTransferRequestId(milestoneId)).toBe(`cat:${milestoneId}:refund`);
    expect(welcomeCreditRequestId(offerId)).toBe(`welcome:${offerId}`);
    expect(seedTopUpRequestId(offerId, 1)).toBe(`seedtopup:${offerId}:1`);
    const nonce = "c".repeat(32);
    expect(sendChargeRequestId(nonce)).toBe(`sch:${nonce}`);
    expect(sendTransferRequestId(nonce)).toBe(`sxf:${nonce}`);
    expect(sendReturnRequestId(nonce)).toBe(`srt:${nonce}`);
    expect(withdrawalRequestId(nonce)).toBe(`wd:${nonce}`);
    expect(sendChargeRequestId(nonce).length).toBeLessThanOrEqual(50);
    expect(withdrawalRequestId(nonce).length).toBeLessThanOrEqual(64);

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
