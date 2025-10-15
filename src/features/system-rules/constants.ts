export const SYSTEM_RULES_ID = "acadlab-system-rules";

export const PERIOD_IDS = ["morning", "afternoon", "evening"] as const;

export type PeriodId = (typeof PERIOD_IDS)[number];

export const MINUTES_PER_DAY = 24 * 60;
