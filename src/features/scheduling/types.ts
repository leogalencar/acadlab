import type { ReservationStatus, Role } from "@prisma/client";

import type { PeriodId } from "@/features/system-rules/constants";
import type { NonTeachingDayRule } from "@/features/system-rules/types";

export interface SerializableLaboratoryOption {
  id: string;
  name: string;
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
}

export type ReservationActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};
