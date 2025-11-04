import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import "./globals.css";

import { getSystemRules } from "@/features/system-rules/server/queries";
import { buildPaletteCssVariables } from "@/features/system-rules/utils";
import { AppNotificationsProvider } from "@/features/notifications/components/app-notifications-provider";

const THEME_INITIALIZATION_SCRIPT = `
(() => {
  try {
    const storageKey = "theme";
    const storedTheme = window.localStorage.getItem(storageKey);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = storedTheme === "dark" || (storedTheme !== "light" && prefersDark) ? "dark" : "light";
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
  } catch {
    // Intentionally ignore errors accessing localStorage
  }
})();
`;

export async function generateMetadata(): Promise<Metadata> {
  const rules = await getSystemRules();
  const brandName = rules.branding.institutionName;
  const logoUrl = rules.branding.logoUrl ?? undefined;

  return {
    title: {
      default: brandName,
      template: `%s • ${brandName}`,
    },
    description: `${brandName} — plataforma baseada em AcadLab para gestão de laboratórios e reservas acadêmicas.`,
    icons: logoUrl
      ? {
          icon: [{ url: logoUrl }],
          shortcut: [{ url: logoUrl }],
        }
      : undefined,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const rules = await getSystemRules();
  const paletteStyles = buildPaletteCssVariables({
    primaryColor: rules.primaryColor,
    secondaryColor: rules.secondaryColor,
    accentColor: rules.accentColor,
    successColor: rules.successColor,
    warningColor: rules.warningColor,
    infoColor: rules.infoColor,
    dangerColor: rules.dangerColor,
  }) as CSSProperties;

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INITIALIZATION_SCRIPT }} />
      </head>
      <body
        className="min-h-screen bg-background text-foreground antialiased"
        style={paletteStyles}
      >
        <AppNotificationsProvider>{children}</AppNotificationsProvider>
      </body>
    </html>
  );
}
