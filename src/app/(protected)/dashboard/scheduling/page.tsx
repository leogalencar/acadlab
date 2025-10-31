import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Role } from "@prisma/client";

import { auth } from "@/auth";
import { SchedulingBoard } from "@/features/scheduling/components/scheduling-board";
import {
  getActiveLaboratoryOptions,
  getSchedulingBoardData,
  getProfessorOptions,
  normalizeDateParam,
} from "@/features/scheduling/server/queries";
import type { SearchParamsLike } from "@/features/shared/search-params";
import { resolveSearchParams } from "@/features/shared/search-params";

export const metadata: Metadata = {
  title: "Agenda de laboratórios",
};

type SchedulingSearchParams = {
  laboratoryId?: string | string[];
  date?: string | string[];
};

export default async function SchedulingPage({
  searchParams,
}: {
  searchParams?: SearchParamsLike<SchedulingSearchParams>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/dashboard/scheduling");
  }

  const resolvedParams = await resolveSearchParams<SchedulingSearchParams>(searchParams);
  const laboratories = await getActiveLaboratoryOptions();

  if (laboratories.length === 0) {
    return (
      <div className="rounded-lg border border-border/60 bg-muted/40 p-8 text-center">
        <h1 className="text-2xl font-semibold text-foreground">Agenda de laboratórios</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Nenhum laboratório ativo foi encontrado. Cadastre um laboratório para iniciar os agendamentos.
        </p>
      </div>
    );
  }

  const requestedLaboratoryId = Array.isArray(resolvedParams?.laboratoryId)
    ? resolvedParams.laboratoryId[0]
    : resolvedParams?.laboratoryId;
  const selectedLaboratoryId = laboratories.some((lab) => lab.id === requestedLaboratoryId)
    ? requestedLaboratoryId!
    : laboratories[0]!.id;

  const selectedDate = normalizeDateParam(resolvedParams?.date);
  const now = new Date();

  const snapshot = await getSchedulingBoardData({
    laboratoryId: selectedLaboratoryId,
    date: selectedDate,
    now,
  });

  let teacherOptions: Awaited<ReturnType<typeof getProfessorOptions>> = [];
  if (session.user.role === Role.ADMIN || session.user.role === Role.TECHNICIAN) {
    teacherOptions = await getProfessorOptions();
  }

  return (
    <SchedulingBoard
      laboratories={laboratories}
      selectedLaboratoryId={selectedLaboratoryId}
      selectedDate={selectedDate}
      schedule={snapshot.schedule}
      actorRole={session.user.role}
      timeZone={snapshot.timeZone}
      nonTeachingRules={snapshot.nonTeachingRules}
      teacherOptions={teacherOptions}
      classPeriod={snapshot.classPeriod}
    />
  );
}
