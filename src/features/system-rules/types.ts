import type { PeriodId } from "@/features/system-rules/constants";

export interface PeriodRuleInput {
  firstClassTime: string;
  classDurationMinutes: number;
  classesCount: number;
  intervalStart: string;
  intervalDurationMinutes: number;
}

export interface SerializableSystemRules {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  periods: Record<PeriodId, PeriodRuleInput>;
  updatedAt?: string;
}

export type SystemRulesActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};
