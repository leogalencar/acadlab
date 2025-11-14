import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Role } from "@prisma/client";

import { auth } from "@/auth";
import { SchedulingBoard } from "@/features/scheduling/components/scheduling-board";
import { SchedulingSearch } from "@/features/scheduling/components/scheduling-search";
import {
  getActiveLaboratoryOption,
  getSchedulingBoardData,
  getProfessorOptions,
  normalizeDateParam,
  searchLaboratoriesForScheduling,
} from "@/features/scheduling/server/queries";
import type { SearchParamsLike } from "@/features/shared/search-params";
import { resolveSearchParams } from "@/features/shared/search-params";
import { getAllSoftwareOptions } from "@/features/software-management/server/queries";
import { createAuditSpan } from "@/lib/logging/audit";

export const metadata: Metadata = {
  title: "Agenda de laboratórios",
};

type SchedulingSearchParams = {
  laboratoryId?: string | string[];
  date?: string | string[];
  time?: string | string[];
  software?: string | string[];
  capacity?: string | string[];
};

export default async function SchedulingPage({
  searchParams,
}: {
  searchParams?: SearchParamsLike<SchedulingSearchParams>;
}) {
  const audit = createAuditSpan(
    { module: "page", action: "SchedulingPage" },
    { hasSearchParams: Boolean(searchParams) },
    "Rendering /dashboard/scheduling",
    { importance: "low", logStart: false, logSuccess: false },
  );
  const session = await auth();

  if (!session?.user) {
    audit.validationFailure({ reason: "not_authenticated" });
    redirect("/login?callbackUrl=/dashboard/scheduling");
  }

  try {
    const resolvedParams = await resolveSearchParams<SchedulingSearchParams>(searchParams);

    const normalizeSingleParam = (value?: string | string[]): string | undefined => {
      const entry = Array.isArray(value) ? value[0] : value;
      if (!entry) {
        return undefined;
      }
      const trimmed = entry.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    };

    const normalizeMultiParam = (value?: string | string[]): string[] => {
      if (!value) {
        return [];
      }
      const entries = Array.isArray(value) ? value : [value];
      return entries
        .map((entry) => entry?.trim())
        .filter((entry): entry is string => Boolean(entry && entry.length > 0));
    };

    const selectedDate = normalizeDateParam(resolvedParams?.date);
    const selectedTime = normalizeSingleParam(resolvedParams?.time);
    const selectedSoftwareIds = normalizeMultiParam(resolvedParams?.software);
    const minimumCapacity = (() => {
      const entry = normalizeSingleParam(resolvedParams?.capacity);
      if (!entry) {
        return undefined;
      }
      const parsed = Number.parseInt(entry, 10);
      if (Number.isNaN(parsed) || parsed <= 0) {
        return undefined;
      }
      return parsed;
    })();
    const requestedLaboratoryId = normalizeSingleParam(resolvedParams?.laboratoryId);

    const now = new Date();

    const [searchResult, softwareCatalog, selectedLaboratory] = await Promise.all([
      searchLaboratoriesForScheduling(
        {
          date: selectedDate,
          time: selectedTime,
          softwareIds: selectedSoftwareIds,
          minimumCapacity,
          now,
        },
        { correlationId: audit.correlationId },
      ),
      getAllSoftwareOptions(),
      requestedLaboratoryId
        ? getActiveLaboratoryOption(requestedLaboratoryId, { correlationId: audit.correlationId })
        : Promise.resolve(null),
    ]);

    let boardSnapshot: Awaited<ReturnType<typeof getSchedulingBoardData>> | null = null;

    if (selectedLaboratory) {
      boardSnapshot = await getSchedulingBoardData(
        {
          laboratoryId: selectedLaboratory.id,
          date: selectedDate,
          now,
        },
        { correlationId: audit.correlationId },
      );
    }

    let teacherOptions: Awaited<ReturnType<typeof getProfessorOptions>> = [];
    if (
      boardSnapshot &&
      (session.user.role === Role.ADMIN || session.user.role === Role.TECHNICIAN)
    ) {
      teacherOptions = await getProfessorOptions({ correlationId: audit.correlationId });
    }

    audit.success({
      searchResults: searchResult.results.length,
      selectedLaboratoryId: selectedLaboratory?.id ?? null,
    });

    return (
      <div className="space-y-8">
      <SchedulingSearch
        date={selectedDate}
        time={selectedTime}
        timeZone={searchResult.timeZone}
        selectedSoftwareIds={selectedSoftwareIds}
        softwareOptions={softwareCatalog}
        results={searchResult.results}
        selectedLaboratoryId={selectedLaboratory?.id}
        minimumCapacity={minimumCapacity}
      />

      {selectedLaboratory && boardSnapshot ? (
        <SchedulingBoard
          laboratory={selectedLaboratory}
          selectedDate={selectedDate}
          schedule={boardSnapshot.schedule}
          actorRole={session.user.role}
          timeZone={boardSnapshot.timeZone}
          nonTeachingRules={boardSnapshot.nonTeachingRules}
          teacherOptions={teacherOptions}
          classPeriod={boardSnapshot.classPeriod}
        />
      ) : requestedLaboratoryId ? (
        <div className="rounded-lg border border-border/60 bg-muted/40 p-6 text-sm text-muted-foreground">
          O laboratório selecionado não está disponível ou não foi encontrado. Utilize a busca acima para escolher outro ambiente.
        </div>
      ) : (
        <div className="rounded-lg border border-border/60 bg-muted/40 p-6 text-sm text-muted-foreground">
          Pesquise e selecione um laboratório para visualizar o calendário de reservas.
        </div>
      )}
      </div>
    );
  } catch (error) {
    audit.failure(error);
    throw error;
  }
}
