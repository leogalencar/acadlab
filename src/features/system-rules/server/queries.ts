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

export async function getSystemRules(): Promise<SerializableSystemRules> {
  const fallback = mapToSerializable(
    DEFAULT_SYSTEM_RULES_MINUTES.schedule,
    DEFAULT_SYSTEM_RULES_MINUTES.colors,
  );

  try {
    const records = await prisma.systemRule.findMany({
      where: {
        name: {
          in: [SYSTEM_RULE_NAMES.COLORS, SYSTEM_RULE_NAMES.SCHEDULE],
        },
      },
    });

    const colorsRecord = records.find((entry) => entry.name === SYSTEM_RULE_NAMES.COLORS);
    const scheduleRecord = records.find((entry) => entry.name === SYSTEM_RULE_NAMES.SCHEDULE);

    const colors = parseColorsValue(colorsRecord?.value) ?? DEFAULT_SYSTEM_RULES_MINUTES.colors;
    const schedule =
      parseScheduleValue(scheduleRecord?.value) ?? DEFAULT_SYSTEM_RULES_MINUTES.schedule;

    const latestUpdate = getLatestDate(colorsRecord?.updatedAt, scheduleRecord?.updatedAt);

    const result = mapToSerializable(schedule, colors);

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

function mapToSerializable(
  schedule: ScheduleRuleMinutes,
  colors: ColorRuleValues,
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
    periods,
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

  const parsed: ScheduleRuleMinutes["periods"] = {} as ScheduleRuleMinutes["periods"];

  for (const period of PERIOD_IDS) {
    const raw = (periods as Record<string, unknown>)[period];
    parsed[period] = parsePeriodValue(raw, DEFAULT_PERIOD_RULES_MINUTES[period]);
  }

  return { periods: parsed };
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
