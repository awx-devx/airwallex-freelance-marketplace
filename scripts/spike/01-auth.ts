import { describeLogin, formatUnknownError, loadAirwallexEnv, requestDetailed } from "@/lib/airwallex";
import { AirwallexError } from "@/lib/airwallex/errors";
import { readString } from "@/lib/airwallex/json";
import { recordFinding } from "./lib/findings";
import { prepareSpike, runDirect, tryCall, writeJson } from "./lib/run";

const PROBE_VERSION = "2026-08-21";

function headerNotes(headers: Headers): Record<string, string> {
  const notes: Record<string, string> = {};
  headers.forEach((value, key) => {
    if (key.includes("version") || key.includes("trace") || key === "x-request-id") notes[key] = value;
  });
  return notes;
}

export async function main(): Promise<void> {
  prepareSpike();
  try {
    const login = await describeLogin();
    console.log(`login ok, expires_at ${login.expiresAt} (${login.expiresInSeconds}s), token length ${login.tokenLength}`);

    const unversioned = await probe(null);
    const pinned = await probe(PROBE_VERSION);
    const config = loadAirwallexEnv();
    const accountId = readString(unversioned.body, "id");

    const summary = {
      expiresAt: login.expiresAt,
      expiresInSeconds: login.expiresInSeconds,
      tokenLength: login.tokenLength,
      unversioned,
      pinned,
      envPlatformAccountId: config.platformAccountId ?? null,
      discoveredAccountId: accountId ?? null,
      platformAccountMatches: config.platformAccountId ? config.platformAccountId === accountId : null,
    };
    writeJson("01-auth.json", summary);

    const match =
      summary.platformAccountMatches === null
        ? "AIRWALLEX_PLATFORM_ACCOUNT_ID is unset, so it was not compared."
        : summary.platformAccountMatches
          ? `AIRWALLEX_PLATFORM_ACCOUNT_ID matches ${accountId}.`
          : `AIRWALLEX_PLATFORM_ACCOUNT_ID does not match the id on ${unversioned.endpoint} (${accountId ?? "none"}).`;

    recordFinding(
      "01",
      [
        `Login returned \`expires_at\` ${login.expiresAt} (${login.expiresInSeconds}s from now). The client refreshes from that timestamp, minus 60s.`,
        `Authenticated \`GET\` without \`x-api-version\`: ${unversioned.endpoint} → ${unversioned.status}.`,
        `Same call with \`x-api-version: ${PROBE_VERSION}\`: ${pinned.endpoint} → ${pinned.status}.`,
        `Response headers containing version/trace: ${JSON.stringify({ unversioned: unversioned.headers, pinned: pinned.headers })}.`,
        match,
        "The client sends `x-api-version` only when `AIRWALLEX_API_VERSION` is set. Leave it unset until this result is accepted.",
      ].join("\n\n"),
    );
  } catch (error) {
    recordFinding("01", `Failed.\n\n\`\`\`\n${formatUnknownError(error)}\n\`\`\``);
    throw error;
  }
}

async function probe(apiVersion: string | null): Promise<{
  endpoint: string;
  status: number;
  headers: Record<string, string>;
  body: unknown;
  note?: string;
}> {
  const account = await tryCall(() => requestDetailed<unknown>("GET", "/api/v1/account", { apiVersion }));
  if (account.ok) {
    return {
      endpoint: "/api/v1/account",
      status: account.data.status,
      headers: headerNotes(account.data.headers),
      body: account.data.data,
    };
  }
  if (account.error instanceof AirwallexError && account.error.status === 404) {
    const balances = await requestDetailed<unknown>("GET", "/api/v1/balances/current", { apiVersion });
    return {
      endpoint: "/api/v1/balances/current",
      status: balances.status,
      headers: headerNotes(balances.headers),
      body: balances.data,
      note: "GET /api/v1/account returned 404",
    };
  }
  throw account.error;
}

runDirect(import.meta.url, main);
