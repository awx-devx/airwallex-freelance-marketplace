"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";
import { themeClassNames, themeIds } from "@/lib/themes";

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      enableColorScheme
      disableTransitionOnChange
      storageKey="theme"
      themes={themeIds}
      value={themeClassNames}
    >
      {children}
    </NextThemesProvider>
  );
}
