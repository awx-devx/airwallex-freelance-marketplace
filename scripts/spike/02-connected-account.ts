import { accounts, formatUnknownError } from "@/lib/airwallex";
import { accountIdOf, accountStatusOf } from "@/lib/airwallex/accounts";
import {
  accountCreateBody,
  identityFixtures,
  type AccountPayloadLevel,
  type FixtureRole,
} from "../seed-data/identity-fixture";
import { recordFinding } from "./lib/findings";
import { tierHints } from "./lib/observe";
import { prepareSpike, runDirect, tryCall, writeJson } from "./lib/run";
import { readState, updateState } from "./lib/state";

const LEVELS: AccountPayloadLevel[] = ["minimal", "identification", "recipient"];

type Attempt = { level: string; step: string; result: string };

export async function main(): Promise<void> {
  prepareSpike();
  let recorded = false;
  try {
    const state = readState();
    const seller = await provision("seller", state.sellerAccountId);
    updateState({
      sellerAccountId: seller.accountId,
      sellerStatus: seller.status,
      sellerPayloadLevel: seller.payloadLevel,
    });
    const revenue = await provision("revenue", readState().revenueAccountId);
    updateState({
      revenueAccountId: revenue.accountId,
      revenueStatus: revenue.status,
      revenuePayloadLevel: revenue.payloadLevel,
    });

    const saved = writeJson("02-connected-account.json", { seller, revenue });
    console.log(`seller ${seller.accountId} ${seller.status} via ${seller.payloadLevel}`);
    console.log(`revenue ${revenue.accountId} ${revenue.status} via ${revenue.payloadLevel}`);
    console.log(`wrote ${saved}`);

    recordFinding(
      "02",
      [
        `Seller \`${seller.accountId}\` status \`${seller.status}\` using payload \`${seller.payloadLevel}\`.`,
        `Revenue \`${revenue.accountId}\` status \`${revenue.status}\` using payload \`${revenue.payloadLevel}\`.`,
        "Submit attempts:",
        "```",
        attemptsText(seller.attempts),
        attemptsText(revenue.attempts),
        "```",
        `Tier-like fields on the seller account: ${seller.tierHints.length ? seller.tierHints.join(", ") : "none found"}.`,
        `Top-level seller keys: ${seller.topLevelKeys.join(", ")}.`,
        seller.status === "ACTIVE" && revenue.status === "ACTIVE"
          ? "Connected accounts and sandbox simulation/update_status are enabled (R1, R2)."
          : "Activation did not reach ACTIVE. The attempt log is the R2 payload result.",
      ].join("\n\n"),
    );
    recorded = true;

    if (seller.status !== "ACTIVE" || revenue.status !== "ACTIVE") {
      throw new Error("Connected account did not reach ACTIVE. See scripts/spike/FINDINGS.md section 02.");
    }
  } catch (error) {
    if (!recorded) {
      recordFinding("02", `Failed.\n\n\`\`\`\n${formatUnknownError(error)}\n\`\`\``);
    }
    throw error;
  }
}

function attemptsText(attempts: Attempt[]): string {
  return attempts.map((attempt) => `${attempt.level} ${attempt.step}: ${attempt.result}`).join("\n");
}

async function provision(role: FixtureRole, existingId: string | undefined) {
  const person = identityFixtures[role];
  const attempts: Attempt[] = [];
  let accountId = existingId;
  let payloadLevel: AccountPayloadLevel | "existing" = "minimal";

    if (accountId) {
      const current = await accounts.retrieveAccount(accountId);
      const status = accountStatusOf(current);
      if (status === "ACTIVE") return summarize(accountId, "existing", attempts, current);
      if (status === "SUBMITTED") {
        const forced = await tryCall(() => accounts.forceAccountStatus(accountId!, "ACTIVE", true));
        attempts.push({
          level: "existing",
          step: "force",
          result: forced.ok ? (accountStatusOf(forced.data) ?? "ok") : formatUnknownError(forced.error),
        });
        const account = await accounts.retrieveAccount(accountId);
        return summarize(accountId, "existing", attempts, account);
      }
    }

  let submitted = false;
  for (const level of LEVELS) {
    payloadLevel = level;
    const body = accountCreateBody(person, level);
    if (!accountId) {
      const created = await accounts.createAccount(body);
      accountId = accountIdOf(created);
      if (!accountId) throw new Error("accounts/create did not return an id");
      attempts.push({ level, step: "create", result: accountStatusOf(created) ?? "created" });
    } else {
      const updated = await accounts.updateAccount(accountId, body);
      attempts.push({ level, step: "update", result: accountStatusOf(updated) ?? "updated" });
    }

    const submit = await tryCall(() => accounts.submitAccount(accountId!));
    if (submit.ok) {
      attempts.push({ level, step: "submit", result: accountStatusOf(submit.data) ?? "submitted" });
      submitted = true;
      break;
    }
    attempts.push({ level, step: "submit", result: formatUnknownError(submit.error) });
  }

  if (!accountId) throw new Error(`No account id for ${role}`);

  if (submitted) {
    const forced = await tryCall(() => accounts.forceAccountStatus(accountId!, "ACTIVE", true));
    attempts.push({
      level: payloadLevel,
      step: "force",
      result: forced.ok ? (accountStatusOf(forced.data) ?? "ok") : formatUnknownError(forced.error),
    });
  }

  const account = await accounts.retrieveAccount(accountId);
  return summarize(accountId, payloadLevel, attempts, account);
}

function summarize(
  accountId: string,
  payloadLevel: string,
  attempts: Attempt[],
  account: Record<string, unknown>,
) {
  return {
    accountId,
    payloadLevel,
    attempts,
    status: accountStatusOf(account) ?? "unknown",
    topLevelKeys: Object.keys(account),
    tierHints: tierHints(account),
    account,
  };
}

runDirect(import.meta.url, main);
