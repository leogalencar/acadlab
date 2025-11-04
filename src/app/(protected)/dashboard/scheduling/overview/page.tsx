import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";

import { auth } from "@/auth";
import { SchedulingOverview } from "@/features/scheduling/components/scheduling-overview";
import { getSchedulingOverview } from "@/features/scheduling/server/queries";

export const metadata: Metadata = {
  title: "Visão geral de agendamentos",
};

export default async function SchedulingOverviewPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/dashboard/scheduling/overview");
  }

  if (session.user.role === Role.PROFESSOR) {
    redirect("/dashboard/scheduling");
  }

  const overview = await getSchedulingOverview({
    id: session.user.id,
    role: session.user.role,
  });

  return <SchedulingOverview data={overview} />;
}
