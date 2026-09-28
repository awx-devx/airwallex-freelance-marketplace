import { z } from "zod";

function emptyToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

const ServerEnvSchema = z
  .object({
    APP_URL: z.string().url().default("http://localhost:3000"),
    MONGODB_URI: z.string().min(1),
    SESSION_SECRET: z.string().min(32),
    DEMO_CURRENCY: z.string().regex(/^[A-Z]{3}$/).default("USD"),
    PLATFORM_FEE_PERCENT: z.number().nonnegative().default(10),
    PROCESSING_RESERVE_PERCENT: z.number().nonnegative().default(2),
    WELCOME_CREDIT_AMOUNT: z.number().positive().default(5000),
    ENABLE_WALLET_RAIL: z.enum(["true", "false"]).default("true"),
    SEED_PASSWORD: z.string().min(1).default("demo1234"),
    DEMO_ADMIN_KEY: z.string().min(1).optional(),
  })
  .superRefine((env, ctx) => {
    if (env.PROCESSING_RESERVE_PERCENT > env.PLATFORM_FEE_PERCENT) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["PROCESSING_RESERVE_PERCENT"],
        message: "PROCESSING_RESERVE_PERCENT must be less than or equal to PLATFORM_FEE_PERCENT.",
      });
    }
  });

export type ServerConfig = {
  appUrl: string;
  mongodbUri: string;
  sessionSecret: string;
  currency: string;
  platformFeePercent: number;
  processingReservePercent: number;
  /** Major units, as in `WELCOME_CREDIT_AMOUNT`. Convert at the Airwallex boundary. */
  welcomeCreditAmount: number;
  walletRailEnabled: boolean;
  seedPassword: string;
  demoAdminKey?: string;
};

/** Offer limits from the frozen contract. Not env-driven. */
export const OFFER_RULES = {
  minMilestoneMinor: 1_000,
  maxOfferTotalMinor: 900_000,
  maxMilestones: 10,
} as const;

function numberOrDefault(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function parseServerConfig(env: Record<string, string | undefined>): ServerConfig {
  const reserveRaw = emptyToUndefined(env.PROCESSING_RESERVE_PERCENT);
  const feeRaw = emptyToUndefined(env.PLATFORM_FEE_PERCENT);
  const welcomeRaw = emptyToUndefined(env.WELCOME_CREDIT_AMOUNT);
  const walletRaw = emptyToUndefined(env.ENABLE_WALLET_RAIL);

  const parsed = ServerEnvSchema.safeParse({
    APP_URL: emptyToUndefined(env.APP_URL) ?? "http://localhost:3000",
    MONGODB_URI: emptyToUndefined(env.MONGODB_URI) ?? "",
    SESSION_SECRET: emptyToUndefined(env.SESSION_SECRET) ?? "",
    DEMO_CURRENCY: emptyToUndefined(env.DEMO_CURRENCY) ?? "USD",
    PLATFORM_FEE_PERCENT: numberOrDefault(feeRaw, 10),
    PROCESSING_RESERVE_PERCENT: numberOrDefault(reserveRaw, 2),
    WELCOME_CREDIT_AMOUNT: numberOrDefault(welcomeRaw, 5000),
    ENABLE_WALLET_RAIL: walletRaw ?? "true",
    SEED_PASSWORD: emptyToUndefined(env.SEED_PASSWORD) ?? "demo1234",
    DEMO_ADMIN_KEY: emptyToUndefined(env.DEMO_ADMIN_KEY),
  });

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("\n");
    throw new Error(
      ["Server environment is incomplete. Check .env.local:", details, "MONGODB_URI and SESSION_SECRET (32+ characters) are required."].join(
        "\n",
      ),
    );
  }

  return {
    appUrl: parsed.data.APP_URL.replace(/\/$/, ""),
    mongodbUri: parsed.data.MONGODB_URI,
    sessionSecret: parsed.data.SESSION_SECRET,
    currency: parsed.data.DEMO_CURRENCY,
    platformFeePercent: parsed.data.PLATFORM_FEE_PERCENT,
    processingReservePercent: parsed.data.PROCESSING_RESERVE_PERCENT,
    welcomeCreditAmount: parsed.data.WELCOME_CREDIT_AMOUNT,
    walletRailEnabled: parsed.data.ENABLE_WALLET_RAIL === "true",
    seedPassword: parsed.data.SEED_PASSWORD,
    demoAdminKey: parsed.data.DEMO_ADMIN_KEY,
  };
}

let cached: ServerConfig | undefined;

export function getServerConfig(): ServerConfig {
  if (!cached) cached = parseServerConfig(process.env);
  return cached;
}

export function resetServerConfigCache(): void {
  cached = undefined;
}
