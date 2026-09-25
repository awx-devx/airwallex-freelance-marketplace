import { z } from "zod";
import { ActivityItemSchema, AirwallexEventSchema } from "@/contracts/activity";
import {
  OfferSchema,
  OfferSummarySchema,
  type CancelReasonInput,
  type CreateOfferInput,
  type OffersQuery,
} from "@/contracts/offers";
import { request } from "@/lib/api/transport";

export const offers = {
  list: (view: OffersQuery["view"]) =>
    request("GET", "/api/offers", undefined, { view }, z.array(OfferSummarySchema)),
  get: (id: string) => request("GET", `/api/offers/${id}`, undefined, undefined, OfferSchema),
  create: (body: CreateOfferInput) => request("POST", "/api/offers", body, undefined, OfferSchema),
  decline: (id: string) => request("POST", `/api/offers/${id}/decline`, undefined, undefined, OfferSchema),
  withdraw: (id: string) => request("POST", `/api/offers/${id}/withdraw`, undefined, undefined, OfferSchema),
  cancelRemaining: (id: string, body: CancelReasonInput = {}) =>
    request("POST", `/api/offers/${id}/cancel-remaining`, body, undefined, OfferSchema),
  sync: (id: string) => request("POST", `/api/offers/${id}/sync`, undefined, undefined, OfferSchema),
  activity: (id: string) => request("GET", `/api/offers/${id}/activity`, undefined, undefined, z.array(ActivityItemSchema)),
  airwallexEvents: (id: string) =>
    request("GET", `/api/offers/${id}/airwallex-events`, undefined, undefined, z.array(AirwallexEventSchema)),
};
