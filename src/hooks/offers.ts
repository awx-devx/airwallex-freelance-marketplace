"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { OfferDTO } from "@/contracts/offers";
import { cardReleaseAccepted } from "@/contracts/permissions";
import { api } from "@/lib/api";
import { qk, type OfferView } from "@/hooks/queryKeys";

function useOfferWriter(offerId: string) {
  const qc = useQueryClient();
  return (offer: OfferDTO) => {
    qc.setQueryData(qk.offer(offerId), offer);
    qc.invalidateQueries({ queryKey: ["offers", "list"] });
    qc.invalidateQueries({ queryKey: qk.offerActivity(offerId) });
    qc.invalidateQueries({ queryKey: qk.offerAwxEvents(offerId) });
    if (offer.milestones.some((milestone) => milestone.status === "PAID" || milestone.status === "REFUNDED")) {
      qc.invalidateQueries({ queryKey: qk.wallet });
    }
  };
}

export function useOffers(view: OfferView) {
  return useQuery({
    queryKey: qk.offerList(view),
    queryFn: () => api.offers.list(view),
  });
}

export function useOffer(id: string) {
  return useQuery({
    queryKey: qk.offer(id),
    queryFn: () => api.offers.get(id),
    enabled: id.length > 0,
  });
}

export function useOfferActivity(id: string) {
  return useQuery({
    queryKey: qk.offerActivity(id),
    queryFn: () => api.offers.activity(id),
    enabled: id.length > 0,
  });
}

export function useOfferAirwallexEvents(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: qk.offerAwxEvents(id),
    queryFn: () => api.offers.airwallexEvents(id),
    enabled: id.length > 0 && (options?.enabled ?? true),
  });
}

export function useCreateOffer() {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: api.offers.create,
    onSuccess: (offer) => {
      qc.setQueryData(qk.offer(offer.id), offer);
      qc.invalidateQueries({ queryKey: qk.offers });
      router.push(`/offers/${offer.id}`);
    },
  });
}

export function useOfferAction(id: string) {
  const write = useOfferWriter(id);
  return {
    decline: useMutation({ mutationFn: () => api.offers.decline(id), onSuccess: write }),
    withdraw: useMutation({ mutationFn: () => api.offers.withdraw(id), onSuccess: write }),
    cancelRemaining: useMutation({
      mutationFn: (reason?: string) => api.offers.cancelRemaining(id, reason ? { reason } : {}),
      onSuccess: write,
    }),
  };
}

export function useMilestoneAction(offerId: string) {
  const write = useOfferWriter(offerId);
  return {
    submitDelivery: useMutation({
      mutationFn: (input: { milestoneId: string; links: string[]; note?: string }) =>
        api.milestones.submitDelivery(offerId, input.milestoneId, { links: input.links, note: input.note }),
      onSuccess: write,
    }),
    requestChanges: useMutation({
      mutationFn: (input: { milestoneId: string; comment: string }) =>
        api.milestones.requestChanges(offerId, input.milestoneId, { comment: input.comment }),
      onSuccess: write,
    }),
    approve: useMutation({
      mutationFn: (milestoneId: string) => api.milestones.approve(offerId, milestoneId),
      onSuccess: write,
    }),
    cancel: useMutation({
      mutationFn: (input: { milestoneId: string; reason?: string }) =>
        api.milestones.cancel(offerId, input.milestoneId, input.reason ? { reason: input.reason } : {}),
      onSuccess: write,
    }),
    retry: useMutation({
      mutationFn: (milestoneId: string) => api.milestones.retry(offerId, milestoneId),
      onSuccess: write,
    }),
  };
}

export function useStartCardPayment(offerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.payments.startCard(offerId),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.offer(offerId) }),
  });
}

export function useReconcilePayment(offerId: string) {
  const write = useOfferWriter(offerId);
  return useMutation({ mutationFn: () => api.payments.reconcile(offerId), onSuccess: write });
}

export function useCancelPayment(offerId: string) {
  const write = useOfferWriter(offerId);
  return useMutation({ mutationFn: () => api.payments.cancel(offerId), onSuccess: write });
}

export function usePayFromWallet(offerId: string) {
  const write = useOfferWriter(offerId);
  return useMutation({ mutationFn: () => api.payments.payFromWallet(offerId), onSuccess: write });
}

function blocksOnAirwallex(offer: OfferDTO): boolean {
  if (offer.status === "AWAITING_PAYMENT") return true;
  return offer.milestones.some((milestone) => milestone.isPending && !cardReleaseAccepted(milestone));
}

export function useOfferSync(offerId: string, offer?: OfferDTO) {
  const qc = useQueryClient();
  const wasPending = useRef(false);
  const [timedOut, setTimedOut] = useState(false);
  const pending = Boolean(offer?.isPending);
  const blocking = Boolean(offer && pending && blocksOnAirwallex(offer));
  const settleInBackground = pending && !blocking;

  useEffect(() => {
    if (!blocking) return;
    const started = Date.now();
    const reset = window.setTimeout(() => setTimedOut(false), 0);
    const id = window.setInterval(() => {
      setTimedOut(Date.now() - started >= 60_000);
    }, 1000);
    return () => {
      window.clearTimeout(reset);
      window.clearInterval(id);
    };
  }, [blocking]);

  useQuery({
    queryKey: [...qk.offer(offerId), "sync"],
    queryFn: async () => {
      const next = await api.offers.sync(offerId);
      qc.setQueryData(qk.offer(offerId), next);
      return next;
    },
    enabled: (blocking && !timedOut) || settleInBackground,
    refetchInterval: blocking && !timedOut ? 3_000 : false,
  });

  useEffect(() => {
    if (wasPending.current && !pending) {
      qc.invalidateQueries({ queryKey: ["offers", "list"] });
      qc.invalidateQueries({ queryKey: qk.offerActivity(offerId) });
      qc.invalidateQueries({ queryKey: qk.offerAwxEvents(offerId) });
      qc.invalidateQueries({ queryKey: qk.wallet });
    }
    wasPending.current = pending;
  }, [pending, offerId, qc]);

  const syncNow = useMutation({
    mutationFn: () => api.offers.sync(offerId),
    onSuccess: (next) => qc.setQueryData(qk.offer(offerId), next),
  });

  return { timedOut, syncNow };
}
