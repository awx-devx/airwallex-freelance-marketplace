import { OfferSchema, type CancelReasonInput, type RequestChangesInput, type SubmitDeliveryInput } from "@/contracts/offers";
import { request } from "@/lib/api/transport";

const offer = (offerId: string, milestoneId: string, action: string, body?: unknown) =>
  request("POST", `/api/offers/${offerId}/milestones/${milestoneId}/${action}`, body, undefined, OfferSchema);

export const milestones = {
  submitDelivery: (offerId: string, milestoneId: string, body: SubmitDeliveryInput) =>
    offer(offerId, milestoneId, "deliveries", body),
  requestChanges: (offerId: string, milestoneId: string, body: RequestChangesInput) =>
    offer(offerId, milestoneId, "request-changes", body),
  approve: (offerId: string, milestoneId: string) => offer(offerId, milestoneId, "approve"),
  cancel: (offerId: string, milestoneId: string, body: CancelReasonInput = {}) =>
    offer(offerId, milestoneId, "cancel", body),
  retry: (offerId: string, milestoneId: string) => offer(offerId, milestoneId, "retry"),
};
