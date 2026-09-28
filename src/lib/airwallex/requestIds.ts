/**
 * Deterministic Airwallex `request_id`s. Payment-acceptance ids are max 64.
 * AIRWALLEX: Charges and connected-account transfers reject ids longer than 50.
 * https://www.airwallex.com/docs/api/scale/connected_account_transfers/create
 */
const PAYMENT_ACCEPTANCE_MAX = 64;
const SCALE_MAX = 50;

export function assertRequestId(requestId: string, max = PAYMENT_ACCEPTANCE_MAX): string {
  if (requestId.length < 1 || requestId.length > max) {
    throw new Error(`request_id must be 1–${max} characters, received ${requestId.length}: ${requestId}`);
  }
  return requestId;
}

export function paymentIntentRequestId(offerId: string, attempt: number): string {
  return assertRequestId(`pi:${offerId}:${attempt}`);
}

export function sellerSplitRequestId(milestoneId: string): string {
  return assertRequestId(`fs:${milestoneId}:seller`);
}

export function revenueSplitRequestId(milestoneId: string): string {
  return assertRequestId(`fs:${milestoneId}:rev`);
}

export function releaseSplitRequestId(splitId: string): string {
  return assertRequestId(`fsr:${splitId}`);
}

export function reverseSplitRequestId(splitId: string): string {
  return assertRequestId(`fsrev:${splitId}`);
}

export function refundRequestId(milestoneId: string): string {
  return assertRequestId(`rf:${milestoneId}`);
}

export function chargeRequestId(offerId: string): string {
  return assertRequestId(`ch:${offerId}`, SCALE_MAX);
}

export function sellerTransferRequestId(milestoneId: string): string {
  return assertRequestId(`cat:${milestoneId}:seller`, SCALE_MAX);
}

export function welcomeCreditRequestId(userId: string): string {
  return assertRequestId(`welcome:${userId}`, SCALE_MAX);
}
