import type { OfferDTO } from "@/contracts/offers";
import { Offer } from "@/models/offer";
import { User, type UserDocument } from "@/models/user";
import { approveMilestone, refundMilestone } from "@/services/escrow";
import { payFromWallet, syncOffer } from "@/services/funding";
import { createAndSend, submitDelivery } from "@/services/offers";
import { SEED_OFFERS, type SeedOfferSpec } from "./seed-data/offers";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function needsWallet(spec: SeedOfferSpec): boolean {
  return spec.milestones.some((milestone) => milestone.links || milestone.then);
}

async function waitFor(user: UserDocument, offerId: string, ready: (offer: OfferDTO) => boolean, label: string): Promise<OfferDTO> {
  const deadline = Date.now() + 30_000;
  for (;;) {
    const offer = await syncOffer(user, offerId);
    if (ready(offer)) return offer;
    if (Date.now() >= deadline) throw new Error(`${label} did not reach its seeded state within 30s.`);
    await sleep(2_000);
  }
}

async function userByEmail(email: string): Promise<UserDocument> {
  const user = await User.findOne({ email });
  if (!user) throw new Error(`Seed user ${email} is missing. Provision users before offers.`);
  return user;
}

/** Create the docs/08 offers. Skips a seedKey that already exists. Wallet steps call Airwallex. */
export async function seedOffers(): Promise<string[]> {
  const rows: string[] = [];
  for (const spec of SEED_OFFERS) {
    const existing = await Offer.findOne({ seedKey: spec.seedKey });
    if (existing) {
      rows.push(`${spec.seedKey}  ${existing.status}  skipped`);
      continue;
    }
    const seller = await userByEmail(spec.sellerEmail);
    const buyer = await userByEmail(spec.buyerEmail);
    const created = await createAndSend(
      seller,
      {
        buyerId: buyer._id.toString(),
        title: spec.title,
        description: spec.description,
        milestones: spec.milestones.map((milestone) => ({ title: milestone.title, amount: milestone.amount })),
      },
      spec.seedKey,
    );
    if (!needsWallet(spec)) {
      rows.push(`${spec.seedKey}  SENT`);
      continue;
    }

    await payFromWallet(buyer, created.id);
    let offer = await waitFor(buyer, created.id, (item) => item.status === "ACTIVE", spec.title);
    for (const step of spec.milestones) {
      const milestone = offer.milestones.find((item) => item.title === step.title);
      if (!milestone) throw new Error(`${spec.title} is missing milestone ${step.title}.`);
      if (step.links) {
        offer = await submitDelivery(seller, offer.id, milestone.id, { links: step.links });
      }
      if (step.then === "approve") {
        await approveMilestone(buyer, offer.id, milestone.id);
        offer = await waitFor(
          buyer,
          offer.id,
          (item) => item.status === "COMPLETED" || item.milestones.some((row) => row.id === milestone.id && row.status === "PAID"),
          `${spec.title} / ${step.title}`,
        );
      }
      if (step.then === "refund") {
        await refundMilestone(buyer, offer.id, milestone.id, { reason: "Seeded cancellation" });
        offer = await waitFor(
          buyer,
          offer.id,
          (item) => item.status === "CANCELLED" || item.milestones.some((row) => row.id === milestone.id && row.status === "REFUNDED"),
          `${spec.title} / ${step.title}`,
        );
      }
    }
    rows.push(`${spec.seedKey}  ${offer.status}`);
  }
  return rows;
}
