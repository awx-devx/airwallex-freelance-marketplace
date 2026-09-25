import { MeSchema } from "@/contracts/users";
import { request } from "@/lib/api/transport";

export const me = {
  get: () => request("GET", "/api/me", undefined, undefined, MeSchema),
  runProvisioning: () => request("POST", "/api/me/provisioning", undefined, undefined, MeSchema),
};
