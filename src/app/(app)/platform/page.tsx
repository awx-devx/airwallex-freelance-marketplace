import { PlatformGate } from "@/components/screens/platform-gate";
import { PlatformScreen } from "@/components/screens/platform-screen";
import { demoAdminUnlocked } from "@/lib/demoAdmin";

export default async function PlatformPage() {
  if (!(await demoAdminUnlocked())) return <PlatformGate />;
  return <PlatformScreen />;
}
