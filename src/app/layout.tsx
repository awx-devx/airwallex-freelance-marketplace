import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/lib/config.public";
import { cn } from "@/lib/utils";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Freelance escrow",
  description: "Milestone escrow demo on an Airwallex sandbox account.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={cn("h-full antialiased", inter.variable)} suppressHydrationWarning>
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
