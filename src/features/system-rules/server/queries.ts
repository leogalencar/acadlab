import { unstable_cache } from "next/cache";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { createAuditSpan } from "@/lib/logging/audit";
import {
  DEFAULT_PERIOD_RULES_MINUTES,
  DEFAULT_SYSTEM_RULES,
  PERIOD_IDS,
  SYSTEM_RULE_NAMES,
} from "@/features/system-rules/constants";
import { formatMinutesToTime } from "@/features/system-rules/utils";
import type {
  AcademicPeriodRule,
  NonTeachingDayRule,
  NonTeachingDayRuleMinutes,
  PeriodRuleMinutes,
  SerializableSystemRules,
  ScheduleRuleMinutes,
} from "@/features/system-rules/types";

type ColorRuleValues = {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  successColor: string;
  warningColor: string;
  infoColor: string;
  dangerColor: string;
};

type EmailDomainRuleValues = {
  domains: string[];
};

type BrandingRuleValues = {
  logoUrl: string | null;
  institutionName: string;
};

async function loadSystemRules(): Promise<SerializableSystemRules> {
  const fallbackSchedule: ScheduleRuleMinutes = {
    timeZone: DEFAULT_SYSTEM_RULES.schedule.timeZone,
    periods: DEFAULT_SYSTEM_RULES.schedule.periods,
    nonTeachingDays: [...DEFAULT_SYSTEM_RULES.schedule.nonTeachingDays] as NonTeachingDayRuleMinutes[],
    academicPeriod: DEFAULT_SYSTEM_RULES.schedule.academicPeriod,
    preventConcurrentTeacherReservations:
      DEFAULT_SYSTEM_RULES.schedule.preventConcurrentTeacherReservations ?? false,
  };

  const fallback = mapToSerializable(
    fallbackSchedule,
    DEFAULT_SYSTEM_RULES.colors,
    { domains: [...DEFAULT_SYSTEM_RULES.account.allowedEmailDomains] },
    DEFAULT_SYSTEM_RULES.branding,
  );

  const audit = createAuditSpan(
    { module: "system-rules", action: "getSystemRules" },
    undefined,
    "Loading system rules",
    { importance: "low", logStart: false, logSuccess: false },
  );

  try {
    const records = await audit.trackPrisma(
      {
        model: "systemRule",
        action: "findMany",
        meta: { names: Object.values(SYSTEM_RULE_NAMES).length },
      },
      () =>
        prisma.systemRule.findMany({
          where: {
            name: {
              in: [
                SYSTEM_RULE_NAMES.COLORS,
                SYSTEM_RULE_NAMES.BRANDING,
                SYSTEM_RULE_NAMES.SCHEDULE,
                SYSTEM_RULE_NAMES.EMAIL_DOMAINS,
              ],
            },
          },
        }),
    );

    const colorsRecord = records.find((entry) => entry.name === SYSTEM_RULE_NAMES.COLORS);
    const scheduleRecord = records.find((entry) => entry.name === SYSTEM_RULE_NAMES.SCHEDULE);
    const brandingRecord = records.find((entry) => entry.name === SYSTEM_RULE_NAMES.BRANDING);
    const emailDomainsRecord = records.find(
      (entry) => entry.name === SYSTEM_RULE_NAMES.EMAIL_DOMAINS,
    );

    const colors = parseColorsValue(colorsRecord?.value) ?? DEFAULT_SYSTEM_RULES.colors;
    const schedule = parseScheduleValue(scheduleRecord?.value) ?? fallbackSchedule;
    const emailDomains =
      parseEmailDomainsValue(emailDomainsRecord?.value) ??
      { domains: [...DEFAULT_SYSTEM_RULES.account.allowedEmailDomains] };
    const branding = parseBrandingValue(brandingRecord?.value) ?? DEFAULT_SYSTEM_RULES.branding;

    const latestUpdate = getLatestDate(
      colorsRecord?.updatedAt,
      scheduleRecord?.updatedAt,
      brandingRecord?.updatedAt,
      emailDomainsRecord?.updatedAt,
    );

    const result = mapToSerializable(schedule, colors, emailDomains, branding);

    if (latestUpdate) {
      result.updatedAt = latestUpdate.toISOString();
    }

    audit.success({ updatedAt: result.updatedAt ?? null }, "Loaded system rules");

    return result;
  } catch (error) {
    audit.failure(error, { stage: "getSystemRules" });
    return fallback;
  }
}

export const getSystemRules = unstable_cache(loadSystemRules, ["system-rules"], {
  tags: ["system-rules"],
});

async function loadAllowedEmailDomains(): Promise<string[]> {
  const audit = createAuditSpan(
    { module: "system-rules", action: "getAllowedEmailDomains" },
    undefined,
    "Loading allowed email domains",
    { importance: "low", logStart: false, logSuccess: false },
  );

  try {
    const record = await audit.trackPrisma(
      { model: "systemRule", action: "findUnique", targetIds: SYSTEM_RULE_NAMES.EMAIL_DOMAINS },
      () =>
        prisma.systemRule.findUnique({
          where: { name: SYSTEM_RULE_NAMES.EMAIL_DOMAINS },
        }),
    );

    const parsed =
      parseEmailDomainsValue(record?.value) ??
      ({ domains: [...DEFAULT_SYSTEM_RULES.account.allowedEmailDomains] } as EmailDomainRuleValues);

    const domains = [...parsed.domains];
    audit.success({ count: domains.length });
    return domains;
  } catch (error) {
    audit.failure(error, { stage: "getAllowedEmailDomains" });
    return [...DEFAULT_SYSTEM_RULES.account.allowedEmailDomains];
  }
}

export const getAllowedEmailDomains = unstable_cache(
  loadAllowedEmailDomains,
  ["allowed-email-domains"],
  { tags: ["system-rules"] },
);

function mapToSerializable(
  schedule: ScheduleRuleMinutes,
  colors: ColorRuleValues,
  emailDomains: EmailDomainRuleValues,
  branding: BrandingRuleValues,
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

  const academicPeriod = schedule.academicPeriod ?? DEFAULT_SYSTEM_RULES.schedule.academicPeriod;

  return {
    primaryColor: colors.primaryColor,
    secondaryColor: colors.secondaryColor,
    accentColor: colors.accentColor,
    successColor: colors.successColor,
    warningColor: colors.warningColor,
    infoColor: colors.infoColor,
    dangerColor: colors.dangerColor,
    timeZone: schedule.timeZone,
    preventConcurrentTeacherReservations: Boolean(
      schedule.preventConcurrentTeacherReservations,
    ),
    nonTeachingDays: schedule.nonTeachingDays.map((rule, index) => {
      if (rule.kind === "weekday") {
        return {
          id: rule.id ?? `non-teaching-${index}`,
          kind: "weekday" as const,
          weekDay: rule.weekDay ?? 0,
          description: rule.description ?? undefined,
        } satisfies NonTeachingDayRule;
      }

      return {
        id: rule.id ?? `non-teaching-${index}`,
        kind: "specific-date" as const,
        date: rule.date ?? "1970-01-01",
        description: rule.description ?? undefined,
        repeatsAnnually: rule.repeatsAnnually,
      } satisfies NonTeachingDayRule;
    }),
    branding: { logoUrl: branding.logoUrl, institutionName: branding.institutionName },
    periods,
    allowedEmailDomains: [...emailDomains.domains],
    academicPeriod: {
      label: academicPeriod.label,
      durationWeeks: academicPeriod.durationWeeks,
      description: academicPeriod.description ?? undefined,
    },
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
  const successColor = record.successColor;
  const warningColor = record.warningColor;
  const infoColor = record.infoColor;
  const dangerColor = record.dangerColor;

  if (
    typeof primaryColor === "string" &&
    typeof secondaryColor === "string" &&
    typeof accentColor === "string"
  ) {
    return {
      primaryColor,
      secondaryColor,
      accentColor,
      successColor:
        typeof successColor === "string" ? successColor : DEFAULT_SYSTEM_RULES.colors.successColor,
      warningColor:
        typeof warningColor === "string" ? warningColor : DEFAULT_SYSTEM_RULES.colors.warningColor,
      infoColor: typeof infoColor === "string" ? infoColor : DEFAULT_SYSTEM_RULES.colors.infoColor,
      dangerColor:
        typeof dangerColor === "string" ? dangerColor : DEFAULT_SYSTEM_RULES.colors.dangerColor,
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
  const timeZone = typeof record.timeZone === "string" ? record.timeZone : DEFAULT_SYSTEM_RULES.schedule.timeZone;
  const preventConcurrentTeacherReservations =
    typeof record.preventConcurrentTeacherReservations === "boolean"
      ? record.preventConcurrentTeacherReservations
      : DEFAULT_SYSTEM_RULES.schedule.preventConcurrentTeacherReservations ?? false;
  const nonTeachingDays = Array.isArray(record.nonTeachingDays)
    ? record.nonTeachingDays
        .map((entry) => parseNonTeachingDay(entry))
        .filter((rule): rule is NonTeachingDayRuleMinutes => rule !== null)
    : [];
  const academicPeriod = parseAcademicPeriodValue(record.academicPeriod) ?? DEFAULT_SYSTEM_RULES.schedule.academicPeriod;

  if (!periods || typeof periods !== "object") {
    return null;
  }

  const parsed: ScheduleRuleMinutes["periods"] = {} as ScheduleRuleMinutes["periods"];

  for (const period of PERIOD_IDS) {
    const raw = (periods as Record<string, unknown>)[period];
    parsed[period] = parsePeriodValue(raw, DEFAULT_PERIOD_RULES_MINUTES[period]);
  }

  return {
    timeZone,
    periods: parsed,
    nonTeachingDays,
    academicPeriod,
    preventConcurrentTeacherReservations,
  };
}

function parseNonTeachingDay(value: unknown): NonTeachingDayRuleMinutes | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const kind = record.kind;

  if (kind === "weekday") {
    const weekDay = record.weekDay;
    if (typeof weekDay === "number" && Number.isInteger(weekDay) && weekDay >= 0 && weekDay <= 6) {
      return {
        kind: "weekday",
        weekDay,
        id: typeof record.id === "string" ? record.id : undefined,
        description: typeof record.description === "string" ? record.description : undefined,
      };
    }
    return null;
  }

  const date = record.date;

  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return null;
  }

  return {
    kind: "specific-date",
    date,
    id: typeof record.id === "string" ? record.id : undefined,
    description: typeof record.description === "string" ? record.description : undefined,
    repeatsAnnually:
      typeof record.repeatsAnnually === "boolean" ? record.repeatsAnnually : undefined,
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

function parseAcademicPeriodValue(value: unknown): AcademicPeriodRule | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const rawLabel = typeof record.label === "string" ? record.label.trim() : "";
  const rawDuration = record.durationWeeks;

  if (!rawLabel || typeof rawDuration !== "number" || !Number.isInteger(rawDuration) || rawDuration <= 0) {
    return null;
  }

  const description = typeof record.description === "string" ? record.description : undefined;

  return {
    label: rawLabel,
    durationWeeks: rawDuration,
    description,
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

function parseBrandingValue(value: Prisma.JsonValue | null | undefined): BrandingRuleValues | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const logoUrl = typeof record.logoUrl === "string" ? record.logoUrl : null;
  const institutionName =
    typeof record.institutionName === "string" && record.institutionName.trim().length > 0
      ? record.institutionName.trim()
      : DEFAULT_SYSTEM_RULES.branding.institutionName;

  return { logoUrl, institutionName };
}
