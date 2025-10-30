export const PERIOD_IDS = ["morning", "afternoon", "evening"] as const;

export type PeriodId = (typeof PERIOD_IDS)[number];

export const MINUTES_PER_DAY = 24 * 60;

export const SYSTEM_RULE_NAMES = {
  COLORS: "ui.colors",
  SCHEDULE: "schedule.periods",
  EMAIL_DOMAINS: "account.allowedEmailDomains",
} as const;

export type SystemRuleName = (typeof SYSTEM_RULE_NAMES)[keyof typeof SYSTEM_RULE_NAMES];

export const DEFAULT_ALLOWED_EMAIL_DOMAINS = [
  "acadlab.local",
  "fatec.sp.gov.br",
] as const;

type IntervalRuleMinutes = {
  start: number;
  durationMinutes: number;
};

type PeriodRuleMinutes = {
  firstClassTime: number;
  classDurationMinutes: number;
  classesCount: number;
  intervals: IntervalRuleMinutes[];
};

export const DEFAULT_COLOR_RULES = {
  primaryColor: "#1D4ED8",
  secondaryColor: "#1E293B",
  accentColor: "#F97316",
} as const;

export const DEFAULT_TIME_ZONE = "America/Sao_Paulo";

export const DEFAULT_ACADEMIC_PERIODS = [];

export const DEFAULT_PERIOD_RULES_MINUTES: Record<PeriodId, PeriodRuleMinutes> = {
  morning: {
    firstClassTime: 7 * 60,
    classDurationMinutes: 50,
    classesCount: 6,
    intervals: [
      {
        start: 9 * 60 + 50,
        durationMinutes: 20,
      },
    ],
  },
  afternoon: {
    firstClassTime: 13 * 60,
    classDurationMinutes: 50,
    classesCount: 5,
    intervals: [
      {
        start: 15 * 60 + 40,
        durationMinutes: 15,
      },
    ],
  },
  evening: {
    firstClassTime: 18 * 60 + 30,
    classDurationMinutes: 50,
    classesCount: 4,
    intervals: [
      {
        start: 19 * 60 + 20,
        durationMinutes: 10,
      },
    ],
  },
};

export const DEFAULT_SYSTEM_RULES_MINUTES = {
  colors: DEFAULT_COLOR_RULES,
  schedule: {
    periods: DEFAULT_PERIOD_RULES_MINUTES,
    timeZone: DEFAULT_TIME_ZONE,
    academicPeriods: DEFAULT_ACADEMIC_PERIODS,
  },
  account: {
    allowedEmailDomains: DEFAULT_ALLOWED_EMAIL_DOMAINS,
  },
};
