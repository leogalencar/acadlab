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

export interface SerializableSystemRules {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  periods: Record<PeriodId, PeriodRuleInput>;
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

export interface ScheduleRuleMinutes {
  periods: Record<PeriodId, PeriodRuleMinutes>;
}

export type SystemRulesActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};
