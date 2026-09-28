import { formatUnknownError, fundsSplits, refundRequestId, refunds, reverseSplitRequestId } from "@/lib/airwallex";
import { readNumber, readString } from "@/lib/airwallex/json";
import { fromAwxAmount } from "@/lib/money";
import { recordFinding } from "./lib/findings";
import { SPIKE_CURRENCY } from "./lib/observe";
import { prepareSpike, runDirect, tryCall, writeJson } from "./lib/run";
import { readState } from "./lib/state";

type SplitRef = { id: string; role: "seller" | "revenue"; status: string; amountMinor: number };

export async function main(): Promise<void> {
  prepareSpike();
  const state = readState();
  if (!state.paymentIntentId || !state.sellerSplitId || !state.revenueSplitId) {
    throw new Error("Spike state is missing splits. Run npm run spike:funds-split after the PaymentIntent succeeds.");
  }

  try {
    const seller = await loadSplit(state.sellerSplitId, "seller");
    const revenue = await loadSplit(state.revenueSplitId, "revenue");
    const unreleased = [revenue, seller].find((split) => split.status === "CREATED");
    const released = [seller, revenue].find((split) => split.status === "RELEASED" || split.status === "SETTLED");

    const unreleasedResult = unreleased
      ? await reverseThenRefund(state.paymentIntentId, unreleased)
      : { note: "No split was still CREATED." };
    const releasedResult = released
      ? await reverseReleased(released)
      : { note: "No split was RELEASED or SETTLED, so reversal-after-release was not attempted." };

    writeJson("07-reversal-and-refund.json", { seller, revenue, unreleasedResult, releasedResult });
    console.log(`unreleased: ${unreleased ? unreleased.id : "none"}`);
    console.log(`released: ${released ? released.id : "none"}`);

    recordFinding(
      "07",
      [
        `Seller split ${seller.id} is \`${seller.status}\`. Revenue split ${revenue.id} is \`${revenue.status}\`.`,
        "Unreleased split (refund before reversal, then reversal, then a second refund only if the first refund failed):",
        "```",
        JSON.stringify(unreleasedResult, null, 2),
        "```",
        "Released split reversal:",
        "```",
        JSON.stringify(releasedResult, null, 2),
        "```",
      ].join("\n\n"),
    );
  } catch (error) {
    recordFinding("07", `Failed.\n\n\`\`\`\n${formatUnknownError(error)}\n\`\`\``);
    throw error;
  }
}

async function loadSplit(id: string, role: SplitRef["role"]): Promise<SplitRef> {
  const split = await fundsSplits.retrieveFundsSplit(id);
  const amount = readString(split, "amount") ?? readNumber(split, "amount");
  if (amount === undefined) throw new Error(`Split ${id} did not include an amount`);
  return {
    id,
    role,
    status: readString(split, "status") ?? "unknown",
    amountMinor: fromAwxAmount(amount, readString(split, "currency") ?? SPIKE_CURRENCY),
  };
}

async function reverseThenRefund(paymentIntentId: string, split: SplitRef) {
  const refundWithoutReversal = await tryCall(() =>
    refunds.createRefund({
      paymentIntentId,
      amountMinor: split.amountMinor,
      currency: SPIKE_CURRENCY,
      requestId: refundRequestId(`spike-${split.role}-first`),
      reason: "Spike refund before reversing an unreleased split",
      metadata: { milestoneId: split.id, share: split.role },
    }),
  );

  const reversal = await tryCall(() =>
    fundsSplits.createFundsSplitReversal({
      fundsSplitId: split.id,
      amountMinor: split.amountMinor,
      currency: SPIKE_CURRENCY,
      requestId: reverseSplitRequestId(split.id),
    }),
  );

  const refundAfterReversal = refundWithoutReversal.ok
    ? { skipped: "first refund was accepted" }
    : await tryCall(() =>
        refunds.createRefund({
          paymentIntentId,
          amountMinor: split.amountMinor,
          currency: SPIKE_CURRENCY,
          requestId: refundRequestId(`spike-${split.role}-second`),
          reason: "Spike refund after reversing an unreleased split",
          metadata: { milestoneId: split.id, share: split.role },
        }),
      );

  const after = await fundsSplits.retrieveFundsSplit(split.id);
  return {
    splitId: split.id,
    refundWithoutReversal: outcome(refundWithoutReversal),
    reversal: outcome(reversal),
    refundAfterReversal: outcome(refundAfterReversal),
    splitStatusAfter: readString(after, "status") ?? "unknown",
  };
}

async function reverseReleased(split: SplitRef) {
  const reversal = await tryCall(() =>
    fundsSplits.createFundsSplitReversal({
      fundsSplitId: split.id,
      amountMinor: split.amountMinor,
      currency: SPIKE_CURRENCY,
      requestId: reverseSplitRequestId(split.id),
    }),
  );
  return { splitId: split.id, statusBefore: split.status, reversal: outcome(reversal) };
}

function outcome(result: { ok: true; data: unknown } | { ok: false; error: unknown } | { skipped: string }) {
  if ("skipped" in result) return result;
  if (!result.ok) return { error: formatUnknownError(result.error) };
  return {
    id: readString(result.data, "id"),
    status: readString(result.data, "status"),
  };
}

runDirect(import.meta.url, main);
