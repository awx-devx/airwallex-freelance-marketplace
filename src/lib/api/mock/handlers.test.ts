import { beforeEach, describe, expect, it } from "vitest";
import { OfferSchema } from "@/contracts/offers";
import { ApiError } from "@/lib/api/errors";
import { flushMockWebhooks, getDb, mockTransport, resetMockDb, submitMockCard } from "@/lib/api/mock";

async function login(email: string) {
  await mockTransport.request("POST", "/api/auth/login", { email, password: "demo1234" });
}

beforeEach(() => {
  resetMockDb();
});

describe("mock offer transitions", () => {
  it("returns a contract-valid offer and rejects a second decline", async () => {
    await login("sam@demo.test");
    const offer = await mockTransport.request("GET", "/api/offers/off_coffee");
    expect(OfferSchema.safeParse(offer).success).toBe(true);

    const declined = await mockTransport.request<{ status: string }>("POST", "/api/offers/off_coffee/decline");
    expect(declined.status).toBe("DECLINED");

    await expect(mockTransport.request("POST", "/api/offers/off_coffee/decline")).rejects.toMatchObject({
      status: 409,
      code: "INVALID_STATE",
    });
  });

  it("lets the buyer approve a delivery, then settles it when the webhook fires", async () => {
    await login("hannah@demo.test");
    const releasing = await mockTransport.request<{ milestones: Array<{ id: string; status: string }> }>(
      "POST",
      "/api/offers/off_social/milestones/off_social_m0/approve",
    );
    expect(releasing.milestones[0]?.status).toBe("RELEASING");

    flushMockWebhooks();
    const paid = await mockTransport.request<{ milestones: Array<{ status: string }>; status: string }>(
      "GET",
      "/api/offers/off_social",
    );
    expect(paid.milestones[0]?.status).toBe("PAID");
  });

  it("rejects a seller approving a milestone", async () => {
    await login("maya@demo.test");
    await expect(
      mockTransport.request("POST", "/api/offers/off_social/milestones/off_social_m0/approve"),
    ).rejects.toBeInstanceOf(ApiError);
    await expect(
      mockTransport.request("POST", "/api/offers/off_social/milestones/off_social_m0/approve"),
    ).rejects.toMatchObject({ status: 409, code: "INVALID_STATE" });
  });

  it("funds a card payment only after the success test card is reconciled", async () => {
    await login("sam@demo.test");
    await mockTransport.request("POST", "/api/offers/off_coffee/payments/card");
    submitMockCard("off_coffee", "4035 5010 0000 0008");
    const funded = await mockTransport.request<{ status: string; milestones: Array<{ status: string }> }>(
      "POST",
      "/api/offers/off_coffee/payments/reconcile",
    );
    expect(funded.status).toBe("ACTIVE");
    expect(funded.milestones.every((milestone) => milestone.status === "FUNDED")).toBe(true);
  });

  it("returns the offer to sent when the decline test card is reconciled", async () => {
    await login("sam@demo.test");
    await mockTransport.request("POST", "/api/offers/off_coffee/payments/card");
    submitMockCard("off_coffee", "4012000300001003");
    const declined = await mockTransport.request<{ status: string }>("POST", "/api/offers/off_coffee/payments/reconcile");
    expect(declined.status).toBe("SENT");
  });

  it("refuses a wallet payment that the balance cannot cover", async () => {
    await login("sam@demo.test");
    const sam = getDb().users.find((user) => user.id === "usr_sam");
    if (!sam) throw new Error("missing sam");
    sam.availableMinor = 0;
    await expect(mockTransport.request("POST", "/api/offers/off_coffee/payments/wallet")).rejects.toMatchObject({
      status: 409,
      code: "INSUFFICIENT_BALANCE",
    });
  });
});
