import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { HistoryTable } from "@/features/scheduling/components/history-table";
import { getReservationHistory } from "@/features/scheduling/server/queries";

export const metadata: Metadata = {
  title: "Histórico de reservas • AcadLab",
};

export default async function HistoryPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/dashboard/scheduling/history");
  }

  const reservations = await getReservationHistory({
    id: session.user.id,
    role: session.user.role,
  });

  return <HistoryTable reservations={reservations} actorRole={session.user.role} />;
}
