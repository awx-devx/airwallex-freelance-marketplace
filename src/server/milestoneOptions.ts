import type { MilestoneActionOptions } from "@/contracts/permissions";
import { getServerConfig } from "@/lib/config";

export function milestoneActionOptions(): MilestoneActionOptions {
  return { sequential: getServerConfig().sequentialMilestones };
}
