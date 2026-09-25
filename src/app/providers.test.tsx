import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Providers } from "./providers";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

describe("Providers", () => {
  it("renders children", () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }),
    });

    render(
      <Providers>
        <p>Hello</p>
      </Providers>,
    );

    expect(screen.getByText("Hello")).toBeTruthy();
  });
});
