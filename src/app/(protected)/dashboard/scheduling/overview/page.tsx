import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";

import { auth } from "@/auth";
import { SchedulingOverview } from "@/features/scheduling/components/scheduling-overview";
import { getSchedulingOverview } from "@/features/scheduling/server/queries";
import { createAuditSpan } from "@/lib/logging/audit";

export const metadata: Metadata = {
  title: "Visão geral de agendamentos",
};

export default async function SchedulingOverviewPage() {
  const audit = createAuditSpan(
    { module: "page", action: "SchedulingOverviewPage" },
    undefined,
    "Rendering /dashboard/scheduling/overview",
    { importance: "low", logStart: false, logSuccess: false },
  );
  const session = await auth();

  if (!session?.user) {
    audit.validationFailure({ reason: "not_authenticated" });
    redirect("/login?callbackUrl=/dashboard/scheduling/overview");
  }

  if (session.user.role === Role.PROFESSOR) {
    audit.validationFailure({ reason: "forbidden", role: session.user.role });
    redirect("/dashboard/scheduling");
  }

  try {
    const overview = await getSchedulingOverview(
      {
        id: session.user.id,
        role: session.user.role,
      },
      { correlationId: audit.correlationId },
    );

    audit.success({ generatedAt: overview.generatedAt });
    return <SchedulingOverview data={overview} />;
  } catch (error) {
    audit.failure(error);
    throw error;
  }
}
