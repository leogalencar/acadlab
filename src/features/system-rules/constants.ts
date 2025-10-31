export const PERIOD_IDS = ["morning", "afternoon", "evening"] as const;

export type PeriodId = (typeof PERIOD_IDS)[number];

export const MINUTES_PER_DAY = 24 * 60;

export const SYSTEM_RULE_NAMES = {
  COLORS: "ui.colors",
  BRANDING: "ui.branding",
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
  successColor: "#059669",
  warningColor: "#F59E0B",
  infoColor: "#0EA5E9",
  dangerColor: "#DC2626",
} as const;

export const DEFAULT_BRANDING_RULES = {
  logoUrl: null as string | null,
  institutionName: "AcadLab",
} as const;

export const SUPPORTED_TIME_ZONES = [
  "America/Rio_Branco",
  "America/Manaus",
  "America/Cuiaba",
  "America/Porto_Velho",
  "America/Boa_Vista",
  "America/Campo_Grande",
  "America/Fortaleza",
  "America/Bahia",
  "America/Sao_Paulo",
] as const;

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

export const DEFAULT_SYSTEM_RULES = {
  colors: DEFAULT_COLOR_RULES,
  branding: DEFAULT_BRANDING_RULES,
  schedule: {
    timeZone: "America/Sao_Paulo",
    periods: DEFAULT_PERIOD_RULES_MINUTES,
    nonTeachingDays: [] as const,
    academicPeriod: {
      label: "Semestre acadêmico",
      durationWeeks: 20,
      description: "Período padrão para turmas semestrais.",
    },
  },
  account: {
    allowedEmailDomains: DEFAULT_ALLOWED_EMAIL_DOMAINS,
  },
} as const;
