import type { ViewerRole } from "@/contracts/offers";

type FundingRail = "CARD" | "WALLET";

/** Where a cancel refund lands, written for the person looking at the dialog. */
export function refundDescription(input: {
  viewerRole: ViewerRole;
  fundingRail?: FundingRail;
  buyerName: string;
  amount?: string;
}): string {
  const destination = refundDestination(input);
  if (input.amount) return `${input.amount} will be refunded to ${destination}.`;
  return `Milestones that haven't been released will be refunded to ${destination}.`;
}

function refundDestination({
  viewerRole,
  fundingRail,
  buyerName,
}: {
  viewerRole: ViewerRole;
  fundingRail?: FundingRail;
  buyerName: string;
}): string {
  if (viewerRole === "BUYER") {
    if (fundingRail === "CARD") return "your card";
    if (fundingRail === "WALLET") return "your wallet";
    return "you";
  }
  if (fundingRail === "CARD") return `${buyerName}'s card`;
  if (fundingRail === "WALLET") return `${buyerName}'s wallet`;
  return buyerName;
}
