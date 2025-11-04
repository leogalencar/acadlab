import type { ReservationStatus, Role } from "@prisma/client";

import type { PeriodId } from "@/features/system-rules/constants";
import type { NonTeachingDayRule } from "@/features/system-rules/types";

export interface SerializableLaboratoryOption {
  id: string;
  name: string;
}

export interface SchedulingLaboratorySearchResult {
  id: string;
  name: string;
  capacity: number;
  software: Array<{
    id: string;
    name: string;
    version: string;
  }>;
  availableSlots: Array<{
    startTime: string;
    endTime: string;
    periodId: PeriodId;
    classIndex: number;
  }>;
  totalMatchingSlots: number;
}

export interface SerializableReservationSummary {
  id: string;
  laboratoryId: string;
  startTime: string;
  endTime: string;
  status: ReservationStatus;
  subject?: string | null;
  createdBy: {
    id: string;
    name: string;
  };
  recurrenceId?: string | null;
}

export interface ReservationSlot {
  id: string;
  periodId: PeriodId;
  classIndex: number;
  startTime: string;
  endTime: string;
  isOccupied: boolean;
  isPast: boolean;
  reservation?: SerializableReservationSummary;
}

export interface PeriodSchedule {
  id: PeriodId;
  label: string;
  slots: ReservationSlot[];
}

export interface DailySchedule {
  date: string;
  periods: PeriodSchedule[];
  isNonTeachingDay: boolean;
  nonTeachingReason?: string;
}

export interface AgendaReservation extends SerializableReservationSummary {
  laboratory: {
    id: string;
    name: string;
  };
}

export interface ReservationHistoryEntry extends AgendaReservation {
  cancellationReason?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
}

export interface SchedulingBoardData {
  laboratories: SerializableLaboratoryOption[];
  selectedLaboratoryId: string;
  selectedDate: string;
  schedule: DailySchedule;
  actorRole: Role;
  timeZone: string;
  nonTeachingRules: NonTeachingDayRule[];
  classPeriod?: AcademicPeriodSummary | null;
}

export interface SerializableUserOption {
  id: string;
  name: string;
}

export interface OverviewRankingEntry {
  id: string;
  name: string;
  reservationsCount: number;
}

export interface OverviewReservation {
  id: string;
  laboratoryName: string;
  startTime: string;
  endTime: string;
  status: ReservationStatus;
  createdByName: string;
  subject?: string | null;
}

export interface AcademicPeriodSummary {
  label: string;
  durationWeeks: number;
  description?: string;
}

export interface SchedulingOverviewData {
  totals: {
    activeNow: number;
    reservationsThisMonth: number;
    cancelledThisMonth: number;
    pendingApproval: number;
  };
  upcoming: OverviewReservation[];
  topLaboratories: OverviewRankingEntry[];
  topRequesters: OverviewRankingEntry[];
  weeklyUsage: Array<{ date: string; reservationsCount: number }>;
  classPeriod?: AcademicPeriodSummary | null;
  timeZone: string;
  generatedAt: string;
}

export type ReservationActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};
