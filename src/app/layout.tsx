import type { CSSProperties } from "react";
import type { Metadata } from "next";
import "./globals.css";

import { getSystemRules } from "@/features/system-rules/server/queries";
import { buildPaletteCssVariables } from "@/features/system-rules/utils";

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
  children: React.ReactNode;
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
    <html lang="pt-BR">
      <body
        className="min-h-screen bg-background text-foreground antialiased"
        style={paletteStyles}
      >
        {children}
      </body>
    </html>
  );
}
