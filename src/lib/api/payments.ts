import { CardPaymentSessionSchema } from "@/contracts/payments";
import { OfferSchema } from "@/contracts/offers";
import { request } from "@/lib/api/transport";

export const payments = {
  startCard: (offerId: string) =>
    request("POST", `/api/offers/${offerId}/payments/card`, undefined, undefined, CardPaymentSessionSchema),
  reconcile: (offerId: string) =>
    request("POST", `/api/offers/${offerId}/payments/reconcile`, undefined, undefined, OfferSchema),
  cancel: (offerId: string) => request("POST", `/api/offers/${offerId}/payments/cancel`, undefined, undefined, OfferSchema),
  payFromWallet: (offerId: string) =>
    request("POST", `/api/offers/${offerId}/payments/wallet`, undefined, undefined, OfferSchema),
};
