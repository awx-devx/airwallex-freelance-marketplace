import { z } from "zod";

const PublicEnvSchema = z.object({
  NEXT_PUBLIC_AIRWALLEX_ENV: z.enum(["demo", "prod"]).default("demo"),
  NEXT_PUBLIC_API_MOCKS: z.enum(["true", "false"]).optional(),
  NEXT_PUBLIC_ENABLE_UI_KIT: z.enum(["true", "false"]).optional(),
});

export type AirwallexEnv = z.infer<typeof PublicEnvSchema>["NEXT_PUBLIC_AIRWALLEX_ENV"];

export type PublicConfig = {
  airwallexEnv: AirwallexEnv;
  apiMocks: boolean;
  uiKitEnabled: boolean;
};

export type PublicEnvInput = {
  NEXT_PUBLIC_AIRWALLEX_ENV?: string;
  NEXT_PUBLIC_API_MOCKS?: string;
  NEXT_PUBLIC_ENABLE_UI_KIT?: string;
};

export function parsePublicConfig(
  env: PublicEnvInput,
  options: { nodeEnv?: string } = {},
): PublicConfig {
  const parsed = PublicEnvSchema.parse(env);
  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV;
  const apiMocks =
    parsed.NEXT_PUBLIC_API_MOCKS !== undefined
      ? parsed.NEXT_PUBLIC_API_MOCKS === "true"
      : nodeEnv !== "production";

  return {
    airwallexEnv: parsed.NEXT_PUBLIC_AIRWALLEX_ENV,
    apiMocks,
    uiKitEnabled: nodeEnv === "development" || parsed.NEXT_PUBLIC_ENABLE_UI_KIT === "true",
  };
}

export function assertApiMocksAllowed(
  config: PublicConfig,
  env: { nodeEnv?: string; allowMocksInProd?: string } = {},
): void {
  const nodeEnv = env.nodeEnv ?? process.env.NODE_ENV;
  const allowMocksInProd = env.allowMocksInProd ?? process.env.ALLOW_MOCKS_IN_PROD;

  // DEMO-ONLY: A production build may opt into the mock transport for a UI preview.
  // PROD: Set NEXT_PUBLIC_API_MOCKS=false so the browser calls real /api routes.
  if (nodeEnv === "production" && config.apiMocks && allowMocksInProd !== "true") {
    throw new Error(
      "NEXT_PUBLIC_API_MOCKS=true is refused when NODE_ENV=production. Set ALLOW_MOCKS_IN_PROD=true only for a UI preview deployment.",
    );
  }
}

const env = {
  NEXT_PUBLIC_AIRWALLEX_ENV: process.env.NEXT_PUBLIC_AIRWALLEX_ENV,
  NEXT_PUBLIC_API_MOCKS: process.env.NEXT_PUBLIC_API_MOCKS,
  NEXT_PUBLIC_ENABLE_UI_KIT: process.env.NEXT_PUBLIC_ENABLE_UI_KIT,
};

export const publicConfig = parsePublicConfig(env);

if (typeof window === "undefined") {
  assertApiMocksAllowed(publicConfig, {
    nodeEnv: process.env.NODE_ENV,
    allowMocksInProd: process.env.ALLOW_MOCKS_IN_PROD,
  });
}
