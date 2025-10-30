import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { SchedulingOverview } from "@/features/scheduling/components/scheduling-overview";
import { getSchedulingOverview } from "@/features/scheduling/server/queries";

export const metadata: Metadata = {
  title: "Painel de agendamentos • AcadLab",
};

export default async function SchedulingOverviewPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/dashboard/scheduling/overview");
  }

  const overview = await getSchedulingOverview({
    id: session.user.id,
    role: session.user.role,
  });

  return <SchedulingOverview data={overview} actorRole={session.user.role} />;
}
