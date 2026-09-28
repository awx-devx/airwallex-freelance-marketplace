import { chargeRequestId, formatUnknownError, wallet } from "@/lib/airwallex";
import { readString } from "@/lib/airwallex/json";
import { recordFinding } from "./lib/findings";
import { SPIKE_CHARGE_MINOR, SPIKE_CURRENCY } from "./lib/observe";
import { pollUntil, prepareSpike, runDirect, tryCall, writeJson } from "./lib/run";
import { readState, updateState } from "./lib/state";

const TERMINAL = new Set(["SETTLED", "FAILED", "SUSPENDED"]);

export async function main(): Promise<void> {
  prepareSpike();
  const source = readState().sellerAccountId;
  if (!source) throw new Error("No seller account in spike state. Run npm run spike:account first.");

  try {
    const created = await tryCall(() =>
      wallet.createCharge({
        amountMinor: SPIKE_CHARGE_MINOR,
        currency: SPIKE_CURRENCY,
        source,
        requestId: chargeRequestId("spike-charge"),
        reason: "professional_business_services",
        reference: "spike charge",
      }),
    );

    if (!created.ok) {
      writeJson("04-charge.json", { source, error: formatUnknownError(created.error) });
      console.log("charge was rejected");
      recordFinding(
        "04",
        [
          `Charge with \`source: ${source}\` was rejected. No extra consent call was made before it.`,
          "```",
          formatUnknownError(created.error),
          "```",
        ].join("\n\n"),
      );
      return;
    }

    const chargeId = readString(created.data, "id");
    if (!chargeId) throw new Error("charges/create did not return an id");
    updateState({ chargeId });

    const settled = await pollUntil({
      read: () => wallet.retrieveCharge(chargeId),
      done: (value) => TERMINAL.has(readString(value, "status") ?? ""),
      timeoutMs: 60_000,
      intervalMs: 3_000,
    });
    const status = readString(settled, "status") ?? "unknown";
    const echoedSource = readString(settled, "source");
    writeJson("04-charge.json", settled);
    console.log(`charge ${chargeId} ${status}, source echoed ${echoedSource ?? "(missing)"}`);

    recordFinding(
      "04",
      [
        `Charge \`${chargeId}\` with \`source: ${source}\` ended \`${status}\`.`,
        `The create response echoed source as \`${echoedSource ?? "(missing)"}\`.`,
        "No separate authorization or consent request was required before `charges/create`.",
      ].join("\n\n"),
    );
  } catch (error) {
    recordFinding("04", `Failed.\n\n\`\`\`\n${formatUnknownError(error)}\n\`\`\``);
    throw error;
  }
}

runDirect(import.meta.url, main);
