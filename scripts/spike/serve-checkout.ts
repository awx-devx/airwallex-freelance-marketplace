import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { recordFinding } from "./lib/findings";
import { checkoutHtmlPath } from "./lib/paths";
import { checkoutPort, prepareSpike, runDirect, writeJson } from "./lib/run";
import { readState } from "./lib/state";

export async function main(): Promise<void> {
  prepareSpike();
  const state = readState();
  if (!state.paymentIntentId || !state.clientSecret) {
    throw new Error("No PaymentIntent client_secret in spike state. Run npm run spike:payment-intent first.");
  }

  const port = checkoutPort();
  const html = readFileSync(checkoutHtmlPath, "utf8");
  const server = createServer(async (req, res) => {
    const url = req.url?.split("?")[0] ?? "/";
    if (req.method === "GET" && url === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(html);
      return;
    }
    if (req.method === "GET" && url === "/config.json") {
      res.writeHead(200, { "content-type": "application/json" }).end(
        JSON.stringify({
          intentId: state.paymentIntentId,
          clientSecret: state.clientSecret,
          currency: state.currency ?? "USD",
          env: "demo",
        }),
      );
      return;
    }
    if (req.method === "POST" && url === "/result") {
      const raw = await readBody(req);
      const result = JSON.parse(raw) as { path?: string; ok?: boolean; detail?: string };
      writeJson("05-checkout-result.json", result);
      recordFinding(
        "checkout",
        [
          `Checkout path \`${result.path ?? "unknown"}\` ${result.ok ? "succeeded" : "failed"}.`,
          result.detail ? `Detail: ${result.detail}` : "No detail was sent.",
          "Browser success is provisional. Run npm run spike:funds-split to retrieve the PaymentIntent.",
        ].join("\n\n"),
      );
      console.log(`checkout result ${result.path} ok=${result.ok}`);
      res.writeHead(204).end();
      return;
    }
    if (req.method === "GET" && url === "/paid") {
      res
        .writeHead(200, { "content-type": "text/html; charset=utf-8" })
        .end("<p>Hosted Payment Page returned. Run <code>npm run spike:funds-split</code> to confirm the PaymentIntent.</p>");
      return;
    }
    res.writeHead(404).end("not found");
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve());
  });
  console.log(`checkout http://127.0.0.1:${port}`);
  console.log(`intent ${state.paymentIntentId}`);
  console.log("Test card 4035 5010 0000 0008, any future expiry, any CVC.");

  await new Promise<void>((resolve) => {
    process.once("SIGINT", () => server.close(() => resolve()));
  });
}

function readBody(req: import("node:http").IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

runDirect(import.meta.url, main);
