import { route } from "@/server/http";
import { toMe } from "@/server/dto/users";
import { runProvisioning } from "@/services/provisioning";

export const runtime = "nodejs";

export const POST = route({}, async ({ user, guest }) => {
  const updated = await runProvisioning(user._id.toString());
  return toMe(updated, guest);
});
