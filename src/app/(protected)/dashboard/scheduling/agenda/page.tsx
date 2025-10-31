import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AgendaList } from "@/features/scheduling/components/agenda-list";
import { getUpcomingReservations } from "@/features/scheduling/server/queries";
import { getSystemRules } from "@/features/system-rules/server/queries";

export const metadata: Metadata = {
  title: "Minha agenda",
};

export default async function AgendaPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/dashboard/scheduling/agenda");
  }

  const [reservations, systemRules] = await Promise.all([
    getUpcomingReservations({
      id: session.user.id,
      role: session.user.role,
    }),
    getSystemRules(),
  ]);

  return (
    <AgendaList
      reservations={reservations}
      actorRole={session.user.role}
      actorId={session.user.id}
      timeZone={systemRules.timeZone}
      nonTeachingRules={systemRules.nonTeachingDays}
    />
  );
}
