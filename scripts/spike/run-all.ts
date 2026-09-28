import { formatUnknownError } from "@/lib/airwallex";
import { main as auth } from "./01-auth";
import { main as connectedAccount } from "./02-connected-account";
import { main as balances } from "./03-balances-and-ca-transfer";
import { main as charge } from "./04-charge";
import { main as paymentIntent } from "./05-payment-intent";
import { main as fundsSplit } from "./06-funds-split-held";
import { main as reversal } from "./07-reversal-and-refund";
import { readState } from "./lib/state";

async function main(): Promise<void> {
  const steps: Array<[string, () => Promise<void>]> = [
    ["01-auth", auth],
    ["02-connected-account", connectedAccount],
    ["03-balances-and-ca-transfer", balances],
    ["04-charge", charge],
    ["05-payment-intent", paymentIntent],
  ];

  for (const [name, step] of steps) {
    console.log(`\n== ${name} ==`);
    try {
      await step();
    } catch (error) {
      console.error(formatUnknownError(error));
      process.exit(1);
    }
  }

  const state = readState();
  if (state.paymentIntentStatus === "SUCCEEDED") {
    try {
      console.log("\n== 06-funds-split-held ==");
      await fundsSplit();
      if (readState().sellerSplitId && readState().revenueSplitId) {
        console.log("\n== 07-reversal-and-refund ==");
        await reversal();
      }
    } catch (error) {
      console.error(formatUnknownError(error));
      process.exit(1);
    }
    return;
  }

  console.log(`
PaymentIntent ${state.paymentIntentId ?? "(missing)"} is ${state.paymentIntentStatus ?? "unknown"}.
Next:
  npm run spike:checkout       # pay with 4035 5010 0000 0008
  npm run spike:funds-split    # after the intent is SUCCEEDED
  npm run spike:refund

Set SPIKE_HOLD_MINUTES=10 on spike:funds-split to watch an unreleased split before releasing it.
`);
}

main().catch((error: unknown) => {
  console.error(formatUnknownError(error));
  process.exit(1);
});
