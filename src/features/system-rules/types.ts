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

export type NonTeachingDayRule =
  | {
      id: string;
      kind: "specific-date";
      date: string;
      description?: string | null;
      repeatsAnnually?: boolean;
    }
  | {
      id: string;
      kind: "weekday";
      weekDay: number;
      description?: string | null;
    };

export interface BrandingSettings {
  logoUrl: string | null;
  institutionName: string;
}

export interface SerializableSystemRules {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  successColor: string;
  warningColor: string;
  infoColor: string;
  dangerColor: string;
  timeZone: string;
  branding: BrandingSettings;
  nonTeachingDays: NonTeachingDayRule[];
  periods: Record<PeriodId, PeriodRuleInput>;
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

export interface NonTeachingDayRuleMinutes {
  kind: "specific-date" | "weekday";
  date?: string;
  weekDay?: number;
  description?: string | null;
  repeatsAnnually?: boolean;
  id?: string;
}

export interface ScheduleRuleMinutes {
  timeZone: string;
  periods: Record<PeriodId, PeriodRuleMinutes>;
  nonTeachingDays: NonTeachingDayRuleMinutes[];
}

export type SystemRulesActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};
