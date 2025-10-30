import type { PeriodId } from "@/features/system-rules/constants";

export interface IntervalRuleInput {
  start: string;
  durationMinutes: number;
}

export interface PeriodRuleInput {
  firstClassTime: string;
  classDurationMinutes: number;
  classesCount: number;
  intervals: IntervalRuleInput[];
}

export type AcademicPeriodType = "BIMESTER" | "TRIMESTER" | "SEMESTER" | "ANNUAL" | "CUSTOM";

export interface AcademicPeriodRuleInput {
  id: string;
  name: string;
  type: AcademicPeriodType;
  startDate: string;
  endDate: string;
}

export interface SerializableSystemRules {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  periods: Record<PeriodId, PeriodRuleInput>;
  timeZone: string;
  academicPeriods: AcademicPeriodRuleInput[];
  allowedEmailDomains: string[];
  updatedAt?: string;
}

export interface IntervalRuleMinutes {
  start: number;
  durationMinutes: number;
}

export interface PeriodRuleMinutes {
  firstClassTime: number;
  classDurationMinutes: number;
  classesCount: number;
  intervals: IntervalRuleMinutes[];
}

export interface AcademicPeriodRuleMinutes {
  id: string;
  name: string;
  type: AcademicPeriodType;
  startDate: string;
  endDate: string;
}

export interface ScheduleRuleMinutes {
  periods: Record<PeriodId, PeriodRuleMinutes>;
  timeZone: string;
  academicPeriods: AcademicPeriodRuleMinutes[];
}

export type SystemRulesActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};
