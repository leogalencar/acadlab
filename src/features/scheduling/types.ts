import type { ReservationStatus, Role } from "@prisma/client";

import type { PeriodId } from "@/features/system-rules/constants";
import type { AcademicPeriodRuleInput } from "@/features/system-rules/types";

export interface SerializableLaboratoryOption {
  id: string;
  name: string;
  capacity: number;
  description?: string | null;
  installedSoftware: Array<{
    id: string;
    name: string;
    version: string;
  }>;
}

export interface SerializableReservationSummary {
  id: string;
  laboratoryId: string;
  startTime: string;
  endTime: string;
  status: ReservationStatus;
  createdBy: {
    id: string;
    name: string;
  };
  recurrenceId?: string | null;
  subject?: string | null;
}

export interface SchedulableUserOption {
  id: string;
  name: string;
  role: Role;
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
  timeZone: string;
}

export interface LaboratoryAvailabilitySummary {
  fullyBookedDates: string[];
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
}

export interface SchedulingBoardData {
  laboratories: SerializableLaboratoryOption[];
  selectedLaboratoryId: string;
  selectedDate: string;
  schedule: DailySchedule;
  availability: LaboratoryAvailabilitySummary;
  actorRole: Role;
  actorId: string;
  actorName: string;
  users: SchedulableUserOption[];
  academicPeriods: AcademicPeriodRuleInput[];
}

export type ReservationActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};
