import type { CSSProperties } from "react";
import type { Metadata } from "next";
import "./globals.css";

import { getSystemRules } from "@/features/system-rules/server/queries";
import { buildPaletteCssVariables } from "@/features/system-rules/utils";

export const metadata: Metadata = {
  title: "AcadLab",
  description:
    "Plataforma AcadLab para gestão de laboratórios, reservas e solicitações de software da Fatec.",
};

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
