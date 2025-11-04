import { createHash } from "crypto";
import Link from "next/link";

import { AuthCard } from "@/features/auth/components/auth-card";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";
import { prisma } from "@/lib/prisma";
import { getSystemRules } from "@/features/system-rules/server/queries";

interface ResetPasswordPageProps {
  params: Promise<{ token: string }>;
}

export default async function ResetPasswordPage({ params }: ResetPasswordPageProps) {
  const { token } = await params;
  const hashedToken = createHash("sha256").update(token).digest("hex");
  const systemRules = await getSystemRules();
  const brandName = systemRules.branding.institutionName;

  const tokenRecord = await prisma.passwordResetToken.findUnique({
    where: { token: hashedToken },
    include: { user: true },
  });

  const isExpired = tokenRecord ? tokenRecord.expiresAt.getTime() < Date.now() : true;

  if (!tokenRecord || isExpired) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12">
        <AuthCard
          title="Link expirado"
          description="Este link de recuperação não é mais válido. Solicite um novo para redefinir sua senha."
          footer={
            <span>
              Precisa de outro link? <Link href="/forgot-password" className="font-medium text-primary hover:underline">Solicite novamente</Link>.
            </span>
          }
        >
          <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            Não foi possível validar o token fornecido.
          </p>
        </AuthCard>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12">
      <AuthCard
        title="Definir nova senha"
        description={`Escolha uma nova senha segura para acessar o ${brandName}.`}
        footer={
          <span>
            Lembrou da senha? <Link href="/login" className="font-medium text-primary hover:underline">Voltar para o login</Link>.
          </span>
        }
      >
        <ResetPasswordForm token={token} email={tokenRecord.user.email} />
      </AuthCard>
    </div>
  );
}
