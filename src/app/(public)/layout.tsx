import Link from "next/link";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-surface">
      <header className="flex items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="font-serif text-xl font-medium tracking-tight">
          Escrow
        </Link>
        <ThemeToggle />
      </header>
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
