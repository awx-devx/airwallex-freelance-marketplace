"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { MeDTO } from "@/contracts/users";
import { ApiError } from "@/lib/api/errors";
import { api } from "@/lib/api";
import { qk } from "@/hooks/queryKeys";

export function usePublicConfig() {
  return useQuery({
    queryKey: qk.config,
    queryFn: () => api.config.getPublic(),
    staleTime: Infinity,
  });
}

export function useMe(options?: { refetchInterval?: number | false }) {
  return useQuery({
    queryKey: qk.me,
    queryFn: async () => {
      try {
        return await api.me.get();
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    refetchInterval: (query) => {
      if (!options?.refetchInterval) return false;
      const step = query.state.data?.provisioning.step;
      if (!step || step === "READY" || step === "FAILED") return false;
      return options.refetchInterval;
    },
  });
}

export function useDemoAccounts() {
  return useQuery({
    queryKey: qk.demoAccounts,
    queryFn: () => api.auth.demoAccounts(),
  });
}

function useSessionMutation(destination: (me: MeDTO) => string) {
  const qc = useQueryClient();
  const router = useRouter();
  return {
    onSuccess: (me: MeDTO) => {
      qc.setQueryData(qk.me, me);
      router.replace(destination(me));
    },
  };
}

export function useSignup() {
  const session = useSessionMutation(() => "/welcome");
  return useMutation({
    mutationFn: api.auth.signup,
    onSuccess: session.onSuccess,
  });
}

export function useLogin() {
  const session = useSessionMutation((me) => (me.provisioning.step === "READY" ? "/" : "/welcome"));
  return useMutation({
    mutationFn: api.auth.login,
    onSuccess: session.onSuccess,
  });
}

export function useGuestLogin() {
  const session = useSessionMutation(() => "/");
  return useMutation({
    mutationFn: api.auth.guest,
    onSuccess: session.onSuccess,
  });
}

export function useLogout() {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: api.auth.logout,
    onSuccess: () => {
      qc.clear();
      router.replace("/login");
    },
  });
}

export function useRunProvisioning() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.me.runProvisioning,
    onSuccess: (me) => qc.setQueryData(qk.me, me),
  });
}

export function useUserSearch(q: string) {
  const trimmed = q.trim();
  return useQuery({
    queryKey: qk.userSearch(trimmed),
    queryFn: () => api.users.search(trimmed),
    enabled: trimmed.length >= 2,
    placeholderData: (previous) => previous,
  });
}
