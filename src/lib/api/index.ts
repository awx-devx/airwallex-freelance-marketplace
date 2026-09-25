import { auth } from "@/lib/api/auth";
import { config } from "@/lib/api/config";
import { me } from "@/lib/api/me";
import { milestones } from "@/lib/api/milestones";
import { offers } from "@/lib/api/offers";
import { payments } from "@/lib/api/payments";
import { platform } from "@/lib/api/platform";
import { users } from "@/lib/api/users";
import { wallet } from "@/lib/api/wallet";
import { publicConfig } from "@/lib/config.public";

export const api = { auth, me, config, users, offers, milestones, payments, wallet, platform };

// DEMO-ONLY: Expose the API library in the console while mocks are on, so flows can be tried without a screen.
// PROD: Do not attach application APIs to window.
if (typeof window !== "undefined" && publicConfig.apiMocks) {
  Object.assign(window, { __api: api });
}

export { ApiError } from "@/lib/api/errors";
export { request } from "@/lib/api/transport";
