import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AcadLab",
  description:
    "Plataforma AcadLab para gestão de laboratórios, reservas e solicitações de software da Fatec.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
