import { OkSchema } from "@/contracts/common";
import { DemoAccountSchema, MeSchema, type LoginInput, type SignupInput } from "@/contracts/users";
import { z } from "zod";
import { request } from "@/lib/api/transport";

export const auth = {
  demoAccounts: () => request("GET", "/api/auth/demo-accounts", undefined, undefined, z.array(DemoAccountSchema)),
  signup: (body: SignupInput) => request("POST", "/api/auth/signup", body, undefined, MeSchema),
  login: (body: LoginInput) => request("POST", "/api/auth/login", body, undefined, MeSchema),
  guest: () => request("POST", "/api/auth/guest", undefined, undefined, MeSchema),
  logout: () => request("POST", "/api/auth/logout", undefined, undefined, OkSchema),
};
