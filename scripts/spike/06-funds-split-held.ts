import { formatUnknownError, fundsSplits, payments, releaseSplitRequestId, revenueSplitRequestId, sellerSplitRequestId, wallet } from "@/lib/airwallex";
import { readNumber, readString } from "@/lib/airwallex/json";
import { recordFinding } from "./lib/findings";
import { historyKinds, SPIKE_CURRENCY, SPIKE_OFFER_ID, spikeBreakdown, usdAvailable } from "./lib/observe";
import { holdMinutes, pollUntil, prepareSpike, runDirect, writeJson } from "./lib/run";
import { readState, updateState } from "./lib/state";

const MOVED = new Set(["RELEASED", "SETTLED", "FAILED"]);

export async function main(): Promise<void> {
  prepareSpike();
  const state = readState();
  if (!state.paymentIntentId || !state.sellerAccountId || !state.revenueAccountId) {
    throw new Error("Spike state is missing the payment intent or connected accounts. Run scripts 02 and 05 first.");
  }

  try {
    const intent = await payments.retrievePaymentIntent(state.paymentIntentId);
    const intentStatus = readString(intent, "status") ?? "unknown";
    updateState({ paymentIntentStatus: intentStatus });
    if (intentStatus !== "SUCCEEDED") {
      throw new Error(
        `PaymentIntent ${state.paymentIntentId} is ${intentStatus}. Pay it with npm run spike:checkout, then re-run npm run spike:funds-split.`,
      );
    }

    const parts = spikeBreakdown();
    const sellerBefore = usdAvailable(await wallet.currentBalances(state.sellerAccountId));
    const revenueBefore = usdAvailable(await wallet.currentBalances(state.revenueAccountId));

    const sellerSplit = await fundsSplits.createFundsSplit({
      amountMinor: parts.sellerMinor,
      currency: SPIKE_CURRENCY,
      destination: state.sellerAccountId,
      sourceId: state.paymentIntentId,
      requestId: sellerSplitRequestId(SPIKE_OFFER_ID),
      autoRelease: false,
      metadata: { milestoneId: SPIKE_OFFER_ID, share: "seller" },
      relatedOfferId: SPIKE_OFFER_ID,
      relatedMilestoneId: SPIKE_OFFER_ID,
    });
    const revenueSplit = await fundsSplits.createFundsSplit({
      amountMinor: parts.revenueMinor,
      currency: SPIKE_CURRENCY,
      destination: state.revenueAccountId,
      sourceId: state.paymentIntentId,
      requestId: revenueSplitRequestId(SPIKE_OFFER_ID),
      autoRelease: false,
      metadata: { milestoneId: SPIKE_OFFER_ID, share: "revenue" },
      relatedOfferId: SPIKE_OFFER_ID,
      relatedMilestoneId: SPIKE_OFFER_ID,
    });

    const sellerSplitId = readString(sellerSplit, "id");
    const revenueSplitId = readString(revenueSplit, "id");
    if (!sellerSplitId || !revenueSplitId) throw new Error("funds_splits/create did not return an id");
    updateState({ sellerSplitId, revenueSplitId });

    const immediateSeller = readString(sellerSplit, "status") ?? "unknown";
    const immediateRevenue = readString(revenueSplit, "status") ?? "unknown";
    const waited = await waitForHold(sellerSplitId, revenueSplitId);

    let released = waited.seller;
    if ((readString(waited.seller, "status") ?? "") === "CREATED") {
      released = await fundsSplits.releaseFundsSplit(sellerSplitId, releaseSplitRequestId(sellerSplitId));
      released = await pollUntil({
        read: () => fundsSplits.retrieveFundsSplit(sellerSplitId),
        done: (value) => MOVED.has(readString(value, "status") ?? ""),
        timeoutMs: 90_000,
        intervalMs: 3_000,
      });
    }

    const sellerAfter = usdAvailable(await wallet.currentBalances(state.sellerAccountId));
    const revenueAfter = usdAvailable(await wallet.currentBalances(state.revenueAccountId));
    const platformHistory = await wallet.balanceHistory({ currency: SPIKE_CURRENCY, pageSize: 10 });
    const kinds = historyKinds(platformHistory);
    const feeRows = feeAmounts(platformHistory);

    const result = {
      breakdownMinor: parts,
      immediate: { seller: immediateSeller, revenue: immediateRevenue },
      afterHold: {
        minutes: holdMinutes(),
        seller: readString(waited.seller, "status"),
        revenue: readString(waited.revenue, "status"),
      },
      releasedSeller: released,
      balances: { sellerBefore, sellerAfter, revenueBefore, revenueAfter },
      platformHistoryKinds: kinds,
      platformFeeAmounts: feeRows,
    };
    writeJson("06-funds-split-held.json", result);

    const releasedStatus = readString(released, "status") ?? "unknown";
    console.log(`seller split ${sellerSplitId} ${immediateSeller} → ${releasedStatus}`);
    console.log(`revenue split ${revenueSplitId} stayed ${readString(waited.revenue, "status")}`);
    console.log(`seller USD available ${sellerBefore} → ${sellerAfter}`);

    recordFinding(
      "06",
      [
        `Held splits on \`${state.paymentIntentId}\` for $100.00: seller ${parts.sellerMinor} minor units, revenue ${parts.revenueMinor}, reserve ${parts.reserveMinor}. Both created with \`auto_release: false\`.`,
        `Immediately after create: seller \`${immediateSeller}\`, revenue \`${immediateRevenue}\`.`,
        `After waiting ${holdMinutes()} minute(s): seller \`${readString(waited.seller, "status")}\`, revenue \`${readString(waited.revenue, "status")}\`. Set SPIKE_HOLD_MINUTES to watch longer. This does not establish the maximum hold (R4).`,
        `Seller split after release: \`${releasedStatus}\`. Seller USD available ${sellerBefore} → ${sellerAfter}. Revenue USD available ${revenueBefore} → ${revenueAfter}.`,
        `Platform balance history source_type: ${kinds.sourceTypes.join(", ") || "(none)"}. transaction_type: ${kinds.transactionTypes.join(", ") || "(none)"}.`,
        `Fee amounts on that history page: ${feeRows.length ? feeRows.join(", ") : "(none)"}.`,
        `Revenue destination ${state.revenueAccountId} is a different connected account from the PaymentIntent's connected_account_id.`,
      ].join("\n\n"),
    );
  } catch (error) {
    recordFinding("06", `Failed.\n\n\`\`\`\n${formatUnknownError(error)}\n\`\`\``);
    throw error;
  }
}

async function waitForHold(sellerSplitId: string, revenueSplitId: string) {
  const minutes = holdMinutes();
  let seller = await fundsSplits.retrieveFundsSplit(sellerSplitId);
  let revenue = await fundsSplits.retrieveFundsSplit(revenueSplitId);
  const deadline = Date.now() + minutes * 60_000;
  while (Date.now() < deadline) {
    if ((readString(seller, "status") ?? "") !== "CREATED" || (readString(revenue, "status") ?? "") !== "CREATED") {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 15_000));
    seller = await fundsSplits.retrieveFundsSplit(sellerSplitId);
    revenue = await fundsSplits.retrieveFundsSplit(revenueSplitId);
  }
  return { seller, revenue };
}

function feeAmounts(history: unknown): string[] {
  const items = history && typeof history === "object" && "items" in history ? (history as { items?: unknown }).items : [];
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => readString(item, "source_type") === "FEE" || readString(item, "transaction_type") === "FEE")
    .map((item) => `${readString(item, "transaction_type") ?? readString(item, "source_type")}:${amountText(item)}`);
}

function amountText(item: unknown): string {
  const numeric = readNumber(item, "amount");
  return readString(item, "amount") ?? (numeric === undefined ? "" : String(numeric));
}

runDirect(import.meta.url, main);
