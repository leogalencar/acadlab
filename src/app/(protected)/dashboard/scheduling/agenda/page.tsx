import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AgendaList } from "@/features/scheduling/components/agenda-list";
import { getUpcomingReservations } from "@/features/scheduling/server/queries";
import { getSystemRules } from "@/features/system-rules/server/queries";
import { createAuditSpan } from "@/lib/logging/audit";

export const metadata: Metadata = {
  title: "Minha agenda",
};

export default async function AgendaPage() {
  const audit = createAuditSpan(
    { module: "page", action: "SchedulingAgendaPage" },
    undefined,
    "Rendering /dashboard/scheduling/agenda",
    { importance: "low", logStart: false, logSuccess: false },
  );
  const session = await auth();

  if (!session?.user) {
    audit.validationFailure({ reason: "not_authenticated" });
    redirect("/login?callbackUrl=/dashboard/scheduling/agenda");
  }

  try {
    const [reservations, systemRules] = await Promise.all([
      getUpcomingReservations(
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
      <AgendaList
        reservations={reservations}
        actorRole={session.user.role}
        actorId={session.user.id}
        timeZone={systemRules.timeZone}
        nonTeachingRules={systemRules.nonTeachingDays}
      />
    );
  } catch (error) {
    audit.failure(error);
    throw error;
  }
}
