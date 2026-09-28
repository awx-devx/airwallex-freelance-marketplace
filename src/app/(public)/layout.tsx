import Link from "next/link";
import { LogoMark } from "@/components/layout/logo-mark";
import { HeaderCredit } from "@/components/layout/powered-by";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-surface">
      <header className="sticky top-0 z-30 border-b border-border bg-background">
        <div className="flex items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" aria-label="Freelance escrow" className="inline-flex items-center text-foreground max-md:min-h-11">
            <LogoMark />
          </Link>
          <ThemeToggle variant="menu" className="md:hidden" />
          <ThemeToggle className="hidden md:inline-grid" />
        </div>
        <HeaderCredit />
      </header>
      <main className="mx-auto w-full max-w-lg flex-1 px-4 pt-10 pb-8 sm:px-6">{children}</main>
    </div>
  );
}
