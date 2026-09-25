import { z } from "zod";
import { PlatformOverviewSchema, WebhookEventRowSchema } from "@/contracts/platform";
import { request } from "@/lib/api/transport";

export const platform = {
  overview: () => request("GET", "/api/platform/overview", undefined, undefined, PlatformOverviewSchema),
  webhooks: () => request("GET", "/api/platform/webhooks", undefined, undefined, z.array(WebhookEventRowSchema)),
};
