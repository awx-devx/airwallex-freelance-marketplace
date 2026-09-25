import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useOffers } from "@/hooks/offers";
import { api } from "@/lib/api";
import { resetMockDb } from "@/lib/api/mock";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  resetMockDb();
});

describe("useOffers", () => {
  it("returns the buyer's incoming offers from the mock transport", async () => {
    await api.auth.login({ email: "sam@demo.test", password: "demo1234" });
    const { result } = renderHook(() => useOffers("incoming"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.some((offer) => offer.title === "Coffee brand identity")).toBe(true);
  });
});
