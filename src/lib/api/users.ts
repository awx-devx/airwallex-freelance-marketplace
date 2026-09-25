import { z } from "zod";
import { UserSummarySchema } from "@/contracts/users";
import { request } from "@/lib/api/transport";

export const users = {
  search: (q: string) => request("GET", "/api/users/search", undefined, { q }, z.array(UserSummarySchema)),
};
