import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  DEFAULT_PERIOD_RULES_MINUTES,
  DEFAULT_SYSTEM_RULES_MINUTES,
  PERIOD_IDS,
  SYSTEM_RULE_NAMES,
} from "@/features/system-rules/constants";
import { formatMinutesToTime } from "@/features/system-rules/utils";
import type {
  PeriodRuleMinutes,
  SerializableSystemRules,
  ScheduleRuleMinutes,
} from "@/features/system-rules/types";

type ColorRuleValues = {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
};

type EmailDomainRuleValues = {
  domains: string[];
};

export async function getSystemRules(): Promise<SerializableSystemRules> {
  const fallback = mapToSerializable(
    DEFAULT_SYSTEM_RULES_MINUTES.schedule,
    DEFAULT_SYSTEM_RULES_MINUTES.colors,
    { domains: [...DEFAULT_SYSTEM_RULES_MINUTES.account.allowedEmailDomains] },
  );

  try {
    const records = await prisma.systemRule.findMany({
      where: {
        name: {
          in: [
            SYSTEM_RULE_NAMES.COLORS,
            SYSTEM_RULE_NAMES.SCHEDULE,
            SYSTEM_RULE_NAMES.EMAIL_DOMAINS,
          ],
        },
      },
    });

    const colorsRecord = records.find((entry) => entry.name === SYSTEM_RULE_NAMES.COLORS);
    const scheduleRecord = records.find((entry) => entry.name === SYSTEM_RULE_NAMES.SCHEDULE);
    const emailDomainsRecord = records.find(
      (entry) => entry.name === SYSTEM_RULE_NAMES.EMAIL_DOMAINS,
    );

    const colors = parseColorsValue(colorsRecord?.value) ?? DEFAULT_SYSTEM_RULES_MINUTES.colors;
    const schedule =
      parseScheduleValue(scheduleRecord?.value) ?? DEFAULT_SYSTEM_RULES_MINUTES.schedule;
    const emailDomains =
      parseEmailDomainsValue(emailDomainsRecord?.value) ??
      { domains: [...DEFAULT_SYSTEM_RULES_MINUTES.account.allowedEmailDomains] };

    const latestUpdate = getLatestDate(
      colorsRecord?.updatedAt,
      scheduleRecord?.updatedAt,
      emailDomainsRecord?.updatedAt,
    );

    const result = mapToSerializable(schedule, colors, emailDomains);

    if (latestUpdate) {
      result.updatedAt = latestUpdate.toISOString();
    }

    return result;
  } catch {
    console.warn(
      "[system-rules] Database indisponível durante a leitura das regras. Utilizando padrões.",
    );
    return fallback;
  }
}

export async function getAllowedEmailDomains(): Promise<string[]> {
  try {
    const record = await prisma.systemRule.findUnique({
      where: { name: SYSTEM_RULE_NAMES.EMAIL_DOMAINS },
    });

    const parsed =
      parseEmailDomainsValue(record?.value) ??
      ({ domains: [...DEFAULT_SYSTEM_RULES_MINUTES.account.allowedEmailDomains] } as EmailDomainRuleValues);

    return [...parsed.domains];
  } catch {
    console.warn(
      "[system-rules] Database indisponível durante a leitura dos domínios permitidos. Utilizando padrões.",
    );
    return [...DEFAULT_SYSTEM_RULES_MINUTES.account.allowedEmailDomains];
  }
}

function mapToSerializable(
  schedule: ScheduleRuleMinutes,
  colors: ColorRuleValues,
  emailDomains: EmailDomainRuleValues,
): SerializableSystemRules {
  const periods = PERIOD_IDS.reduce((accumulator, period) => {
    const persisted = schedule.periods[period] ?? DEFAULT_PERIOD_RULES_MINUTES[period];

    accumulator[period] = {
      firstClassTime: formatMinutesToTime(persisted.firstClassTime),
      classDurationMinutes: persisted.classDurationMinutes,
      classesCount: persisted.classesCount,
      intervals: (persisted.intervals ?? []).map((interval) => ({
        start: formatMinutesToTime(interval.start),
        durationMinutes: interval.durationMinutes,
      })),
    };

    return accumulator;
  }, {} as SerializableSystemRules["periods"]);

  return {
    primaryColor: colors.primaryColor,
    secondaryColor: colors.secondaryColor,
    accentColor: colors.accentColor,
    timeZone: schedule.timeZone,
    academicPeriods: [...schedule.academicPeriods],
    periods,
    allowedEmailDomains: [...emailDomains.domains],
  };
}

function parseColorsValue(
  value: Prisma.JsonValue | null | undefined,
): ColorRuleValues | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const primaryColor = record.primaryColor;
  const secondaryColor = record.secondaryColor;
  const accentColor = record.accentColor;

  if (
    typeof primaryColor === "string" &&
    typeof secondaryColor === "string" &&
    typeof accentColor === "string"
  ) {
    return {
      primaryColor,
      secondaryColor,
      accentColor,
    };
  }

  return null;
}

function parseEmailDomainsValue(
  value: Prisma.JsonValue | null | undefined,
): EmailDomainRuleValues | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const rawDomains = record.domains;

  if (!Array.isArray(rawDomains)) {
    return null;
  }

  const domains = rawDomains
    .filter((candidate): candidate is string => typeof candidate === "string")
    .map((domain) => domain.trim().toLowerCase())
    .filter((domain) => domain.length > 0);

  if (domains.length === 0) {
    return null;
  }

  return { domains: Array.from(new Set(domains)) };
}

function parseScheduleValue(
  value: Prisma.JsonValue | null | undefined,
): ScheduleRuleMinutes | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const periods = record.periods;

  if (!periods || typeof periods !== "object") {
    return null;
  }

  const parsedPeriods: ScheduleRuleMinutes["periods"] = {} as ScheduleRuleMinutes["periods"];

  for (const period of PERIOD_IDS) {
    const raw = (periods as Record<string, unknown>)[period];
    parsedPeriods[period] = parsePeriodValue(raw, DEFAULT_PERIOD_RULES_MINUTES[period]);
  }

  const timeZone =
    typeof record.timeZone === "string" && record.timeZone.length > 0
      ? record.timeZone
      : DEFAULT_SYSTEM_RULES_MINUTES.schedule.timeZone;

  const academicPeriods = Array.isArray(record.academicPeriods)
    ? record.academicPeriods
        .map((period) => parseAcademicPeriodValue(period))
        .filter(
          (period): period is ScheduleRuleMinutes["academicPeriods"][number] =>
            period !== null,
        )
    : [];

  return {
    periods: parsedPeriods,
    timeZone,
    academicPeriods,
  };
}

function parsePeriodValue(
  value: unknown,
  fallback: PeriodRuleMinutes,
): PeriodRuleMinutes {
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const record = value as Record<string, unknown>;

  const firstClassTime = coercePositiveInteger(record.firstClassTime);
  const classDurationMinutes = coercePositiveInteger(record.classDurationMinutes);
  const classesCount = coercePositiveInteger(record.classesCount);

  if (
    firstClassTime === null ||
    classDurationMinutes === null ||
    classesCount === null
  ) {
    return fallback;
  }

  const intervals = Array.isArray(record.intervals)
    ? record.intervals
        .map((interval) => parseIntervalValue(interval))
        .filter((interval): interval is PeriodRuleMinutes["intervals"][number] => interval !== null)
    : [];

  return {
    firstClassTime,
    classDurationMinutes,
    classesCount,
    intervals,
  };
}

function parseAcademicPeriodValue(value: unknown): ScheduleRuleMinutes["academicPeriods"][number] | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id : null;
  const name = typeof record.name === "string" ? record.name : null;
  const type = typeof record.type === "string" ? record.type : null;
  const startDate = typeof record.startDate === "string" ? record.startDate : null;
  const endDate = typeof record.endDate === "string" ? record.endDate : null;

  if (!id || !name || !type || !startDate || !endDate) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return null;
  }

  return {
    id,
    name,
    type: type as ScheduleRuleMinutes["academicPeriods"][number]["type"],
    startDate,
    endDate,
  };
}

function parseIntervalValue(value: unknown): PeriodRuleMinutes["intervals"][number] | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const start = coercePositiveInteger(record.start);
  const durationMinutes = coercePositiveInteger(record.durationMinutes, true);

  if (start === null || durationMinutes === null) {
    return null;
  }

  return {
    start,
    durationMinutes,
  };
}

function coercePositiveInteger(value: unknown, allowZero = false): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  if (!allowZero && value <= 0) {
    return null;
  }

  if (allowZero && value < 0) {
    return null;
  }

  return Math.trunc(value);
}

function getLatestDate(...dates: Array<Date | undefined>): Date | null {
  const timestamps = dates
    .filter((date): date is Date => Boolean(date))
    .map((date) => date.getTime());

  if (!timestamps.length) {
    return null;
  }

  return new Date(Math.max(...timestamps));
}
