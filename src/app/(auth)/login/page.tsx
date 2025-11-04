import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AuthCard } from "@/features/auth/components/auth-card";
import { LoginForm } from "@/features/auth/components/login-form";
import { getSystemRules } from "@/features/system-rules/server/queries";

interface LoginPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  }

  const systemRules = await getSystemRules();
  const brandName = systemRules.branding.institutionName;
  const brandLogo = systemRules.branding.logoUrl;

  const params = await searchParams;
  const callbackUrl = typeof params?.callbackUrl === "string" ? params.callbackUrl : undefined;
  const successMessage = params?.reset === "success"
    ? "Senha redefinida com sucesso! Faça login com a nova senha."
    : undefined;

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/10 px-4 py-12">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.15),_transparent_45%)]" aria-hidden />
      <AuthCard
        title={`Acesse o ${brandName}`}
        description="Use seu e-mail institucional e senha para continuar."
        footer={
          <div className="space-y-0.5 text-center">
            <span>
              Problemas com o acesso? {" "}
              <Link href="mailto:suporte@acadlab.local" className="font-medium text-primary hover:underline">
                Contate o suporte
              </Link>.
            </span>
            <p className="text-xs text-muted-foreground">Baseado na plataforma AcadLab.</p>
          </div>
        }
      >
        {brandLogo ? (
          <div className="mb-6 flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={brandLogo} alt={`${brandName} logo`} className="h-12 w-auto object-contain" />
          </div>
        ) : null}
        <LoginForm callbackUrl={callbackUrl} successMessage={successMessage} />
      </AuthCard>
    </div>
  );
}
