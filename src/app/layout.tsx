import type { Metadata } from "next";
import { Inter, Newsreader } from "next/font/google";
import "@/lib/config.public";
import { cn } from "@/lib/utils";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-serif",
});

const title = "Freelance Marketplace";
const description = "Milestone payments, released when the buyer approves.";

function metadataBase() {
  try {
    return new URL(process.env.APP_URL || "http://localhost:3000");
  } catch {
    return new URL("http://localhost:3000");
  }
}

export const metadata: Metadata = {
  metadataBase: metadataBase(),
  title: { default: title, template: `%s · ${title}` },
  description,
  applicationName: title,
  openGraph: {
    title,
    description,
    siteName: title,
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: `${title}. ${description}` }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/favicon-light.svg", type: "image/svg+xml", media: "(prefers-color-scheme: light)" },
      { url: "/favicon-dark.svg", type: "image/svg+xml", media: "(prefers-color-scheme: dark)" },
      { url: "/favicon-light.png", type: "image/png", sizes: "64x64", media: "(prefers-color-scheme: light)" },
      { url: "/favicon-dark.png", type: "image/png", sizes: "64x64", media: "(prefers-color-scheme: dark)" },
    ],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={cn("h-full antialiased", inter.variable, newsreader.variable)} suppressHydrationWarning>
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
