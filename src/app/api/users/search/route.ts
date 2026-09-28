import { UserSearchQuerySchema } from "@/contracts/users";
import { route } from "@/server/http";
import { searchUsers } from "@/services/auth";

export const runtime = "nodejs";

export const GET = route({ query: UserSearchQuerySchema }, async ({ user, query }) => searchUsers(user._id.toString(), query.q));
