import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AgendaList } from "@/features/scheduling/components/agenda-list";
import { getUpcomingReservations } from "@/features/scheduling/server/queries";

export const metadata: Metadata = {
  title: "Minha agenda • AcadLab",
};

export default async function AgendaPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/dashboard/scheduling/agenda");
  }

  const reservations = await getUpcomingReservations({
    id: session.user.id,
    role: session.user.role,
  });

  return (
    <AgendaList
      reservations={reservations}
      actorRole={session.user.role}
      currentUserId={session.user.id}
    />
  );
}
