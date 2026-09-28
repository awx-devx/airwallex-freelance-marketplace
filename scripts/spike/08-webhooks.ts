import { createServer, type IncomingMessage } from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { extractAccountId, extractObject, formatUnknownError, requireWebhookSecret, verifyAirwallexSignature } from "@/lib/airwallex";
import { readString } from "@/lib/airwallex/json";
import { recordFinding } from "./lib/findings";
import { outDir } from "./lib/paths";
import { prepareSpike, runDirect, webhookPort } from "./lib/run";

const SUBSCRIPTIONS = [
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "payment_intent.cancelled",
  "funds_split.created",
  "funds_split.released",
  "funds_split.settled",
  "funds_split.failed",
  "refund.received",
  "refund.accepted",
  "refund.settled",
  "refund.failed",
  "charge.settled",
  "charge.failed",
  "charge.suspended",
  "connected_account_transfer.settled",
  "connected_account_transfer.failed",
  "connected_account_transfer.suspended",
  "account.active",
  "account.action_required",
  "account.suspended",
];

type Received = { name: string; id: string; accountId?: string; signatureValid: boolean; file: string };

export async function main(): Promise<void> {
  prepareSpike();
  const secret = requireWebhookSecret();
  const port = webhookPort();
  const dir = join(outDir, "webhooks");
  mkdirSync(dir, { recursive: true });
  const received: Received[] = [];

  const server = createServer(async (req, res) => {
    if (req.method !== "POST" || req.url?.split("?")[0] !== "/api/webhooks/airwallex") {
      res.writeHead(404).end("not found");
      return;
    }
    try {
      const raw = await readRaw(req);
      const timestamp = req.headers["x-timestamp"];
      const signature = req.headers["x-signature"];
      const timestampText = Array.isArray(timestamp) ? timestamp[0] : timestamp ?? null;
      const signatureText = Array.isArray(signature) ? signature[0] : signature ?? null;
      let signatureValid = verifyAirwallexSignature(raw, timestampText ?? null, signatureText ?? null, secret);
      if (!signatureValid) {
        // DEMO-ONLY: Test events from the sandbox web app are signed with client-secret-key, not the endpoint secret.
        // PROD: Verify only with AIRWALLEX_WEBHOOK_SECRET.
        const testSecret = headerValue(req, "client-secret-key");
        if (testSecret && process.env.NODE_ENV !== "production") {
          signatureValid = verifyAirwallexSignature(raw, timestampText ?? null, signatureText ?? null, testSecret);
        }
      }

      const payload = JSON.parse(raw) as unknown;
      const name = readString(payload, "name") ?? "unknown";
      const id = readString(payload, "id") ?? String(Date.now());
      const file = join(dir, `${name.replace(/[^a-z0-9.]+/gi, "_")}-${id.replace(/[^a-z0-9_-]+/gi, "_")}.json`);
      writeFileSync(file, `${JSON.stringify({ signatureValid, payload }, null, 2)}\n`);
      const entry = { name, id, accountId: extractAccountId(payload), signatureValid, file };
      received.push(entry);
      console.log(`${signatureValid ? "valid" : "INVALID"} ${name} ${id} account ${entry.accountId ?? "-"}`);
      console.log(`object keys: ${Object.keys(asRecord(extractObject(payload))).join(", ") || "(none)"}`);
      recordFinding("08", findingText(received));
      res.writeHead(signatureValid ? 200 : 400).end(signatureValid ? "ok" : "invalid signature");
    } catch (error) {
      console.error(formatUnknownError(error));
      res.writeHead(400).end("bad payload");
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve());
  });

  console.log(`webhook listener http://127.0.0.1:${port}/api/webhooks/airwallex`);
  console.log("In another terminal: cloudflared tunnel --url http://127.0.0.1:" + port);
  console.log("Register https://<tunnel>/api/webhooks/airwallex and subscribe to:");
  for (const name of SUBSCRIPTIONS) console.log(`  ${name}`);
  console.log("Ctrl+C stops the listener and keeps the payloads in scripts/spike/out/webhooks/.");
  recordFinding("08", findingText(received));

  await new Promise<void>((resolve) => {
    process.once("SIGINT", () => {
      server.close(() => resolve());
    });
  });
}

function findingText(received: Received[]): string {
  if (received.length === 0) {
    return [
      "Listener is running and has not received an event yet.",
      "Subscribe in the sandbox web app, then trigger a payment, split, charge, or transfer.",
      "Whether funds-split reversal events are offered in the web app is not visible from this listener until one arrives.",
    ].join("\n\n");
  }
  const lines = received.map(
    (event) =>
      `- \`${event.name}\` \`${event.id}\` signature ${event.signatureValid ? "valid" : "invalid"} account ${event.accountId ?? "-"}`,
  );
  return ["Received events (raw payloads are in scripts/spike/out/webhooks/):", ...lines].join("\n");
}

function headerValue(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readRaw(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

runDirect(import.meta.url, main);
