/** Built-in themes. A later theme is one entry here plus a CSS variable block. */

export const themes = [
  { id: "light", label: "Light", className: "light", dark: false },
  { id: "dark", label: "Dark", className: "dark", dark: true },
] as const;

export type ThemeId = (typeof themes)[number]["id"];

export const themeIds: ThemeId[] = themes.map((theme) => theme.id);

/** Class string next-themes writes on `<html>`. Dark palettes include `dark`. */
export const themeClassNames: Record<string, string> = Object.fromEntries(
  themes.map((theme) => [theme.id, theme.className]),
);

export const themePreferences = ["light", "system", "dark"] as const;

export type ThemePreference = (typeof themePreferences)[number];
