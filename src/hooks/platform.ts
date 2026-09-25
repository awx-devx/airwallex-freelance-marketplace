"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { qk } from "@/hooks/queryKeys";

export function usePlatformOverview() {
  return useQuery({
    queryKey: qk.platform,
    queryFn: () => api.platform.overview(),
    refetchInterval: 5_000,
  });
}

export function usePlatformWebhooks() {
  return useQuery({
    queryKey: qk.platformWebhooks,
    queryFn: () => api.platform.webhooks(),
    refetchInterval: 5_000,
  });
}
