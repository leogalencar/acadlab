import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { HistoryTable } from "@/features/scheduling/components/history-table";
import { getReservationHistory } from "@/features/scheduling/server/queries";
import { getSystemRules } from "@/features/system-rules/server/queries";
import { createAuditSpan } from "@/lib/logging/audit";

export const metadata: Metadata = {
  title: "Histórico de reservas",
};

export default async function HistoryPage() {
  const audit = createAuditSpan(
    { module: "page", action: "SchedulingHistoryPage" },
    undefined,
    "Rendering /dashboard/scheduling/history",
    { importance: "low", logStart: false, logSuccess: false },
  );
  const session = await auth();

  if (!session?.user) {
    audit.validationFailure({ reason: "not_authenticated" });
    redirect("/login?callbackUrl=/dashboard/scheduling/history");
  }

  try {
    const [reservations, systemRules] = await Promise.all([
      getReservationHistory(
        {
          id: session.user.id,
          role: session.user.role,
        },
        { correlationId: audit.correlationId },
      ),
      getSystemRules(),
    ]);

    audit.success({ reservationCount: reservations.length });

    return (
      <HistoryTable
        reservations={reservations}
        actorRole={session.user.role}
        timeZone={systemRules.timeZone}
      />
    );
  } catch (error) {
    audit.failure(error);
    throw error;
  }
}
