import { formatUnknownError, wallet, welcomeCreditRequestId } from "@/lib/airwallex";
import { readString } from "@/lib/airwallex/json";
import { recordFinding } from "./lib/findings";
import { historyKinds, SPIKE_CURRENCY, SPIKE_TOP_UP_MINOR, usdAvailable } from "./lib/observe";
import { pollUntil, prepareSpike, runDirect, writeJson } from "./lib/run";
import { readState, updateState } from "./lib/state";

const TERMINAL = new Set(["SETTLED", "FAILED", "SUSPENDED"]);

export async function main(): Promise<void> {
  prepareSpike();
  const sellerAccountId = readState().sellerAccountId;
  if (!sellerAccountId) throw new Error("No seller account in spike state. Run npm run spike:account first.");

  try {
    const transfer = await wallet.createConnectedAccountTransfer({
      amountMinor: SPIKE_TOP_UP_MINOR,
      currency: SPIKE_CURRENCY,
      destination: sellerAccountId,
      requestId: welcomeCreditRequestId("spike-seller"),
      reason: "professional_business_services",
      reference: "spike welcome credit",
    });
    const transferId = readString(transfer, "id");
    if (!transferId) throw new Error("connected_account_transfers/create did not return an id");
    updateState({ transferId });

    const settled = await pollUntil({
      read: () => wallet.retrieveConnectedAccountTransfer(transferId),
      done: (value) => TERMINAL.has(readString(value, "status") ?? ""),
      timeoutMs: 60_000,
      intervalMs: 3_000,
    });

    const [platformBalances, sellerBalances, sellerHistory] = await Promise.all([
      wallet.currentBalances(),
      wallet.currentBalances(sellerAccountId),
      wallet.balanceHistory({ onBehalfOf: sellerAccountId, currency: SPIKE_CURRENCY, pageSize: 10 }),
    ]);
    const kinds = historyKinds(sellerHistory);
    const status = readString(settled, "status") ?? "unknown";

    writeJson("03-balances-and-ca-transfer.json", {
      transfer: settled,
      platformUsdAvailable: usdAvailable(platformBalances),
      sellerUsdAvailable: usdAvailable(sellerBalances),
      sellerBalances,
      sellerHistory,
    });

    console.log(`transfer ${transferId} ${status}`);
    console.log(`seller USD available ${usdAvailable(sellerBalances)}`);
    console.log(`history source_type ${kinds.sourceTypes.join(", ") || "(none)"}`);
    console.log(`history transaction_type ${kinds.transactionTypes.join(", ") || "(none)"}`);

    recordFinding(
      "03",
      [
        `CA Transfer \`${transferId}\` to \`${sellerAccountId}\` for $50.00 ended \`${status}\`.`,
        `Platform USD available: ${usdAvailable(platformBalances)}. Seller USD available (x-on-behalf-of): ${usdAvailable(sellerBalances)}.`,
        `Seller balance history source_type values: ${kinds.sourceTypes.join(", ") || "(none)"}.`,
        `Seller balance history transaction_type values: ${kinds.transactionTypes.join(", ") || "(none)"}.`,
        "`balances/current` is called with and without `x-on-behalf-of`. History is filtered to USD.",
      ].join("\n\n"),
    );
  } catch (error) {
    recordFinding("03", `Failed.\n\n\`\`\`\n${formatUnknownError(error)}\n\`\`\``);
    throw error;
  }
}

runDirect(import.meta.url, main);
