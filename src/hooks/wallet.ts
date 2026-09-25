"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { qk } from "@/hooks/queryKeys";

export function useWallet() {
  return useQuery({
    queryKey: qk.wallet,
    queryFn: () => api.wallet.get(),
  });
}

export function useWalletTransactions() {
  return useInfiniteQuery({
    queryKey: qk.walletTx,
    queryFn: ({ pageParam }) => api.wallet.transactions({ cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor,
  });
}
