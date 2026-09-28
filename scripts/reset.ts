import readline from "node:readline";
import { connectDb, disconnectDb } from "@/lib/db";
import { Activity } from "@/models/activity";
import { AirwallexLog } from "@/models/airwallexLog";
import { Offer } from "@/models/offer";
import { Payment } from "@/models/payment";
import { PlatformSettings } from "@/models/platformSettings";
import { User } from "@/models/user";
import { WebhookEvent } from "@/models/webhookEvent";

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function confirm(hard: boolean): Promise<boolean> {
  if (hasFlag("--yes")) return Promise.resolve(true);
  if (!process.stdin.isTTY) {
    console.error("Refusing to reset without --yes when there is no terminal.");
    return Promise.resolve(false);
  }
  const prompt = hard
    ? "Delete demo data and seed users in Mongo? Airwallex accounts are kept. Type yes: "
    : "Delete demo data in Mongo? Seed users and Airwallex accounts are kept. Type yes: ";
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "yes");
    });
  });
}

async function main(): Promise<void> {
  // DEMO-ONLY: Wipes Mongo demo data. It never calls Airwallex to delete connected accounts.
  // PROD: No reset script. Account offboarding is a separate workflow.
  const hard = hasFlag("--hard");
  if (!(await confirm(hard))) {
    console.log("Reset cancelled.");
    return;
  }

  await connectDb();
  const [offers, payments, activity, webhooks, logs, regularUsers] = await Promise.all([
    Offer.deleteMany({}),
    Payment.deleteMany({}),
    Activity.deleteMany({}),
    WebhookEvent.deleteMany({}),
    AirwallexLog.deleteMany({}),
    User.deleteMany({ kind: "REGULAR" }),
  ]);
  const seedUsers = hard ? await User.deleteMany({ kind: "SEED" }) : null;
  if (hard) {
    await PlatformSettings.updateOne({ _id: "default" }, { $inc: { seedVersion: 1 } });
  }

  console.log(
    [
      `offers ${offers.deletedCount}`,
      `payments ${payments.deletedCount}`,
      `activity ${activity.deletedCount}`,
      `webhook_events ${webhooks.deletedCount}`,
      `airwallex_logs ${logs.deletedCount}`,
      `regular users ${regularUsers.deletedCount}`,
      seedUsers ? `seed users ${seedUsers.deletedCount}` : "seed users kept",
      "Airwallex accounts kept",
    ].join(", "),
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => disconnectDb());
