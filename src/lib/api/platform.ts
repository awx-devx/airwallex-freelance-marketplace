import { z } from "zod";
import { OkSchema } from "@/contracts/common";
import { DemoAdminUnlockSchema, PlatformOverviewSchema, WebhookEventRowSchema, type DemoAdminUnlockInput } from "@/contracts/platform";
import { request } from "@/lib/api/transport";

export const platform = {
  overview: () => request("GET", "/api/platform/overview", undefined, undefined, PlatformOverviewSchema),
  webhooks: () => request("GET", "/api/platform/webhooks", undefined, undefined, z.array(WebhookEventRowSchema)),
  unlock: (input: DemoAdminUnlockInput) =>
    request("POST", "/api/platform/unlock", DemoAdminUnlockSchema.parse(input), undefined, OkSchema),
};
