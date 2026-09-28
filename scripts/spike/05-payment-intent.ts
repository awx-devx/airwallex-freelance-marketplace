import { formatUnknownError, paymentIntentRequestId, payments } from "@/lib/airwallex";
import type { JsonObject } from "@/lib/airwallex/json";
import { readString } from "@/lib/airwallex/json";
import { recordFinding } from "./lib/findings";
import { SPIKE_AMOUNT_MINOR, SPIKE_CURRENCY, SPIKE_OFFER_ID } from "./lib/observe";
import { checkoutPort, prepareSpike, runDirect, writeJson } from "./lib/run";
import { readState, updateState } from "./lib/state";

const PAYABLE = new Set(["REQUIRES_PAYMENT_METHOD", "REQUIRES_CUSTOMER_ACTION", "REQUIRES_CAPTURE", "PENDING"]);

export async function main(): Promise<void> {
  prepareSpike();
  const sellerAccountId = readState().sellerAccountId;
  if (!sellerAccountId) throw new Error("No seller account in spike state. Run npm run spike:account first.");

  try {
    const state = readState();
    const existing = state.paymentIntentId
      ? await payments.retrievePaymentIntent(state.paymentIntentId)
      : undefined;
    const existingStatus = readString(existing, "status");
    const reusable = Boolean(existing && (existingStatus === "SUCCEEDED" || PAYABLE.has(existingStatus ?? "")));

    let intent: JsonObject;
    let attempt = state.paymentAttempt ?? 1;
    if (reusable && existing) {
      intent = existing;
    } else {
      attempt = (state.paymentAttempt ?? 0) + 1;
      intent = await payments.createPaymentIntent({
        amountMinor: SPIKE_AMOUNT_MINOR,
        currency: SPIKE_CURRENCY,
        merchantOrderId: SPIKE_OFFER_ID,
        requestId: paymentIntentRequestId(SPIKE_OFFER_ID, attempt),
        connectedAccountId: sellerAccountId,
        metadata: { offerId: SPIKE_OFFER_ID, offerRef: "SPIKE" },
        returnUrl: `http://127.0.0.1:${checkoutPort()}/paid`,
        relatedOfferId: SPIKE_OFFER_ID,
      });
    }

    const paymentIntentId = readString(intent, "id");
    const status = readString(intent, "status") ?? "unknown";
    const clientSecret = readString(intent, "client_secret") ?? state.clientSecret;
    if (!paymentIntentId) throw new Error("payment_intents/create did not return an id");

    updateState({
      paymentIntentId,
      paymentIntentStatus: status,
      paymentAttempt: attempt,
      clientSecret,
      currency: SPIKE_CURRENCY,
      amountMinor: SPIKE_AMOUNT_MINOR,
    });

    writeJson("05-payment-intent.json", {
      id: paymentIntentId,
      status,
      connected_account_id: readString(intent, "connected_account_id") ?? sellerAccountId,
      amount: intent.amount,
      currency: intent.currency,
      client_secret: clientSecret ?? null,
      reused: reusable,
    });

    console.log(`payment intent ${paymentIntentId} ${status}`);
    if (clientSecret) console.log(`client_secret ${clientSecret}`);
    console.log(`pay it with: npm run spike:checkout`);

    recordFinding(
      "05",
      [
        `PaymentIntent \`${paymentIntentId}\` status \`${status}\` with \`connected_account_id\` ${sellerAccountId}.`,
        "The create body does not include `funds_split_data`.",
        status === "SUCCEEDED"
          ? "The intent is already SUCCEEDED. Run npm run spike:funds-split."
          : "Drop-in has not been exercised yet. Run `npm run spike:checkout` and pay with test card 4035 5010 0000 0008. The page records whether Drop-in or the Hosted Payment Page loaded.",
      ].join("\n\n"),
    );
  } catch (error) {
    recordFinding("05", `Failed.\n\n\`\`\`\n${formatUnknownError(error)}\n\`\`\``);
    throw error;
  }
}

runDirect(import.meta.url, main);
