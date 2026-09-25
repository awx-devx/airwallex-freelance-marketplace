import { describe, expect, it } from "vitest";
import {
  milestoneActions,
  offerActions,
  offerIsPending,
  type MilestonePermissionInput,
  type MilestoneStatus,
  type OfferAction,
  type OfferStatus,
  type ViewerRole,
} from "@/contracts";

const OFFER_STATUSES: OfferStatus[] = [
  "SENT",
  "AWAITING_PAYMENT",
  "ACTIVE",
  "COMPLETED",
  "CANCELLED",
  "DECLINED",
  "WITHDRAWN",
];

const MILESTONE_STATUSES: MilestoneStatus[] = [
  "PENDING_FUNDING",
  "FUNDED",
  "SUBMITTED",
  "CHANGES_REQUESTED",
  "RELEASING",
  "PAID",
  "RELEASE_FAILED",
  "REFUNDING",
  "REFUNDED",
  "REFUND_FAILED",
];

const ROLES: ViewerRole[] = ["BUYER", "SELLER"];

function offerExpectations(status: OfferStatus, role: ViewerRole, cancellable: boolean): OfferAction[] {
  if (status === "SENT" && role === "BUYER") return ["ACCEPT_AND_PAY", "DECLINE"];
  if (status === "SENT" && role === "SELLER") return ["WITHDRAW"];
  if (status === "AWAITING_PAYMENT" && role === "BUYER") return ["CONTINUE_PAYMENT", "CANCEL_PAYMENT"];
  if (status === "ACTIVE" && cancellable) return ["CANCEL_REMAINING"];
  return [];
}

function milestoneExpectations(status: MilestoneStatus, role: ViewerRole): string[] {
  if (status === "FUNDED" && role === "SELLER") return ["SUBMIT_DELIVERY", "CANCEL"];
  if (status === "FUNDED" && role === "BUYER") return ["CANCEL"];
  if (status === "CHANGES_REQUESTED" && role === "SELLER") return ["SUBMIT_DELIVERY", "CANCEL"];
  if (status === "CHANGES_REQUESTED" && role === "BUYER") return ["CANCEL"];
  if (status === "SUBMITTED" && role === "BUYER") return ["APPROVE", "REQUEST_CHANGES", "CANCEL"];
  if (status === "SUBMITTED" && role === "SELLER") return ["CANCEL"];
  if (status === "RELEASE_FAILED" || status === "REFUND_FAILED") return ["RETRY"];
  return [];
}

describe("offerActions", () => {
  it("covers every offer status and role", () => {
    for (const status of OFFER_STATUSES) {
      for (const role of ROLES) {
        for (const cancellable of [false, true]) {
          const milestones = cancellable ? [{ status: "FUNDED" as const }] : [{ status: "PAID" as const }];
          expect(offerActions({ status, milestones }, role), `${status} ${role} cancellable=${cancellable}`).toEqual(
            offerExpectations(status, role, cancellable),
          );
        }
      }
    }
  });
});

describe("milestoneActions", () => {
  it("covers every milestone status and role while the offer is active", () => {
    for (const status of MILESTONE_STATUSES) {
      for (const role of ROLES) {
        const milestone: MilestonePermissionInput = { status, index: 0 };
        const offer = { status: "ACTIVE" as const, milestones: [{ status, index: 0 }] };
        expect(milestoneActions(milestone, offer, role), `${status} ${role}`).toEqual(milestoneExpectations(status, role));
      }
    }
  });

  it("returns nothing when the offer is not active", () => {
    for (const status of MILESTONE_STATUSES) {
      for (const role of ROLES) {
        expect(
          milestoneActions({ status, index: 0 }, { status: "SENT", milestones: [{ status, index: 0 }] }, role),
        ).toEqual([]);
      }
    }
  });

  it("offers retry when a pending milestone has a last error", () => {
    expect(
      milestoneActions(
        { status: "RELEASING", index: 0, lastError: "Airwallex timeout" },
        { status: "ACTIVE", milestones: [{ status: "RELEASING", index: 0 }] },
        "BUYER",
      ),
    ).toEqual(["RETRY"]);
  });

  it("holds delivery until the previous milestone is paid when sequential", () => {
    const offer = {
      status: "ACTIVE" as const,
      milestones: [
        { status: "FUNDED" as const, index: 0 },
        { status: "FUNDED" as const, index: 1 },
      ],
    };
    expect(milestoneActions({ status: "FUNDED", index: 1 }, offer, "SELLER", { sequential: true })).toEqual(["CANCEL"]);

    expect(
      milestoneActions(
        { status: "FUNDED", index: 1 },
        {
          status: "ACTIVE",
          milestones: [
            { status: "PAID", index: 0 },
            { status: "FUNDED", index: 1 },
          ],
        },
        "SELLER",
        { sequential: true },
      ),
    ).toEqual(["SUBMIT_DELIVERY", "CANCEL"]);
  });
});

describe("offerIsPending", () => {
  it("is true while payment or a milestone is in flight", () => {
    expect(offerIsPending({ status: "AWAITING_PAYMENT", milestones: [] })).toBe(true);
    expect(offerIsPending({ status: "ACTIVE", milestones: [{ status: "RELEASING" }] })).toBe(true);
    expect(offerIsPending({ status: "ACTIVE", milestones: [{ status: "FUNDED" }] })).toBe(false);
  });
});
