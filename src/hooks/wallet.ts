"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { qk } from "@/hooks/queryKeys";

export function useWallet(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: qk.wallet,
    queryFn: () => api.wallet.get(),
    enabled: options?.enabled ?? true,
  });
}

function useWalletWriter() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: qk.wallet });
    qc.invalidateQueries({ queryKey: qk.walletTx });
  };
}

export function useWithdraw() {
  const refresh = useWalletWriter();
  return useMutation({ mutationFn: api.wallet.withdraw, onSuccess: refresh });
}

export function useSendFunds() {
  const refresh = useWalletWriter();
  return useMutation({ mutationFn: api.wallet.send, onSuccess: refresh });
}

export function useWalletTransactions() {
  return useInfiniteQuery({
    queryKey: qk.walletTx,
    queryFn: ({ pageParam }) => api.wallet.transactions({ cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor,
  });
}
