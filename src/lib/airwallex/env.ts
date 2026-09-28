import { z } from "zod";

const AirwallexEnvSchema = z.object({
  AIRWALLEX_API_BASE: z.string().url().default("https://api.sandbox.airwallex.com"),
  AIRWALLEX_CLIENT_ID: z.string().min(1),
  AIRWALLEX_API_KEY: z.string().min(1),
  AIRWALLEX_WEBHOOK_SECRET: z.string().min(1).optional(),
  AIRWALLEX_PLATFORM_ACCOUNT_ID: z.string().min(1).optional(),
  AIRWALLEX_API_VERSION: z.string().min(1).optional(),
});

export type AirwallexConfig = {
  apiBase: string;
  clientId: string;
  apiKey: string;
  webhookSecret?: string;
  platformAccountId?: string;
  apiVersion?: string;
};

function blankToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function parseAirwallexEnv(env: Record<string, string | undefined>): AirwallexConfig {
  const parsed = AirwallexEnvSchema.safeParse({
    AIRWALLEX_API_BASE: blankToUndefined(env.AIRWALLEX_API_BASE) ?? "https://api.sandbox.airwallex.com",
    AIRWALLEX_CLIENT_ID: blankToUndefined(env.AIRWALLEX_CLIENT_ID) ?? "",
    AIRWALLEX_API_KEY: blankToUndefined(env.AIRWALLEX_API_KEY) ?? "",
    AIRWALLEX_WEBHOOK_SECRET: blankToUndefined(env.AIRWALLEX_WEBHOOK_SECRET),
    AIRWALLEX_PLATFORM_ACCOUNT_ID: blankToUndefined(env.AIRWALLEX_PLATFORM_ACCOUNT_ID),
    AIRWALLEX_API_VERSION: blankToUndefined(env.AIRWALLEX_API_VERSION),
  });

  if (!parsed.success) {
    throw new Error(
      [
        "Airwallex credentials in .env.local are incomplete.",
        "Fill these in from the sandbox web app (Developer → API keys), then re-run:",
        "  AIRWALLEX_CLIENT_ID",
        "  AIRWALLEX_API_KEY",
        "npm run spike:webhooks also needs AIRWALLEX_WEBHOOK_SECRET.",
        "AIRWALLEX_PLATFORM_ACCOUNT_ID is optional; spike 01 compares it when set.",
      ].join("\n"),
    );
  }

  return {
    apiBase: parsed.data.AIRWALLEX_API_BASE.replace(/\/$/, ""),
    clientId: parsed.data.AIRWALLEX_CLIENT_ID,
    apiKey: parsed.data.AIRWALLEX_API_KEY,
    webhookSecret: parsed.data.AIRWALLEX_WEBHOOK_SECRET,
    platformAccountId: parsed.data.AIRWALLEX_PLATFORM_ACCOUNT_ID,
    apiVersion: parsed.data.AIRWALLEX_API_VERSION,
  };
}

let cached: AirwallexConfig | undefined;

export function loadAirwallexEnv(): AirwallexConfig {
  if (!cached) cached = parseAirwallexEnv(process.env);
  return cached;
}

export function requireWebhookSecret(): string {
  const secret = loadAirwallexEnv().webhookSecret;
  if (!secret) {
    throw new Error(
      "AIRWALLEX_WEBHOOK_SECRET is empty. Copy it from Developer → Webhooks in the sandbox web app, then re-run npm run spike:webhooks.",
    );
  }
  return secret;
}
