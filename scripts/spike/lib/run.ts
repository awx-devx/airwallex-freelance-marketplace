import { appendFileSync, mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { formatUnknownError, loadAirwallexEnv, setAirwallexLogger, type AirwallexConfig } from "@/lib/airwallex";
import { outDir } from "./paths";

export function prepareSpike(): AirwallexConfig {
  const config = loadAirwallexEnv();
  if (!config.apiBase.includes("api.sandbox.airwallex.com") && process.env.SPIKE_ALLOW_PRODUCTION !== "true") {
    throw new Error(
      "Spike scripts only call the Airwallex sandbox. Set AIRWALLEX_API_BASE=https://api.sandbox.airwallex.com.",
    );
  }
  if ((process.env.DEMO_CURRENCY ?? "USD") !== "USD") {
    throw new Error("Spike scripts require DEMO_CURRENCY=USD. src/lib/money.ts only converts USD.");
  }
  mkdirSync(outDir, { recursive: true });
  setAirwallexLogger((entry) => {
    appendFileSync(join(outDir, "calls.jsonl"), `${JSON.stringify(entry)}\n`);
  });
  return config;
}

export function writeJson(name: string, value: unknown): string {
  mkdirSync(outDir, { recursive: true });
  const path = join(outDir, name);
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
  return path;
}

export async function tryCall<T>(fn: () => Promise<T>): Promise<{ ok: true; data: T } | { ok: false; error: unknown }> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    return { ok: false, error };
  }
}

export function isDirectRun(metaUrl: string): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return metaUrl === pathToFileURL(realpathSync(entry)).href;
  } catch {
    return metaUrl === pathToFileURL(entry).href;
  }
}

export function runDirect(metaUrl: string, main: () => Promise<void>): void {
  if (!isDirectRun(metaUrl)) return;
  main().catch((error: unknown) => {
    console.error(formatUnknownError(error));
    process.exit(1);
  });
}

export async function pollUntil<T>(options: {
  read: () => Promise<T>;
  done: (value: T) => boolean;
  timeoutMs: number;
  intervalMs: number;
}): Promise<T> {
  const started = Date.now();
  let latest = await options.read();
  while (!options.done(latest) && Date.now() - started < options.timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, options.intervalMs));
    latest = await options.read();
  }
  return latest;
}

export function holdMinutes(): number {
  const value = Number(process.env.SPIKE_HOLD_MINUTES ?? "0");
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("SPIKE_HOLD_MINUTES must be a non-negative number of minutes.");
  }
  return value;
}

export function checkoutPort(): number {
  return Number(process.env.SPIKE_CHECKOUT_PORT ?? "4599");
}

export function webhookPort(): number {
  return Number(process.env.SPIKE_WEBHOOK_PORT ?? "8787");
}
