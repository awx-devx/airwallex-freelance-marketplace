import { PublicConfigSchema } from "@/contracts/users";
import { request } from "@/lib/api/transport";

export const config = {
  getPublic: () => request("GET", "/api/config/public", undefined, undefined, PublicConfigSchema),
};
