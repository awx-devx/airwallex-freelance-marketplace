import { route } from "@/server/http";
import { toMe } from "@/server/dto/users";

export const runtime = "nodejs";

export const GET = route({}, async ({ user, guest }) => toMe(user, guest));
