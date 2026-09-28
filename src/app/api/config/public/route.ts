import { toPublicConfig } from "@/server/dto/publicConfig";
import { publicRoute } from "@/server/http";
import { getServerConfig } from "@/lib/config";
import { publicConfig } from "@/lib/config.public";

export const runtime = "nodejs";

export const GET = publicRoute({}, async () => toPublicConfig(getServerConfig(), publicConfig));
