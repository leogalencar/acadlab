import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AuthCard } from "@/features/auth/components/auth-card";
import { PasswordResetRequestForm } from "@/features/auth/components/password-reset-request-form";

export default async function ForgotPasswordPage() {
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12">
      <AuthCard
        title="Recuperar acesso"
        description="Informe seu e-mail institucional para receber o link de recuperação."
        footer={
          <span>
            Lembrou a senha? <Link href="/login" className="font-medium text-primary hover:underline">Voltar para o login</Link>.
          </span>
        }
      >
        <PasswordResetRequestForm />
      </AuthCard>
    </div>
  );
}
