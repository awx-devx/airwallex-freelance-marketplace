import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UiKitScreen } from "@/components/dev/ui-kit-screen";

export const metadata: Metadata = {
  title: "UI kit",
};

export default function UiKitPage() {
  // DEMO-ONLY: Internal component showcase. Always available in local development.
  // PROD: Leave NEXT_PUBLIC_ENABLE_UI_KIT unset so this route 404s.
  const enabled = process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_ENABLE_UI_KIT === "true";
  if (!enabled) notFound();
  return <UiKitScreen />;
}
