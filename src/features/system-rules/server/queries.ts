import { prisma } from "@/lib/prisma";
import {
  PERIOD_IDS,
  SYSTEM_RULES_ID,
  type PeriodId,
} from "@/features/system-rules/constants";
import {
  formatMinutesToTime,
} from "@/features/system-rules/utils";
import type { SerializableSystemRules } from "@/features/system-rules/types";

const FALLBACK_RULES: SerializableSystemRules = {
  primaryColor: "#1D4ED8",
  secondaryColor: "#1E293B",
  accentColor: "#F97316",
  periods: {
    morning: {
      firstClassTime: "07:00",
      classDurationMinutes: 50,
      classesCount: 6,
      intervalStart: "09:50",
      intervalDurationMinutes: 20,
    },
    afternoon: {
      firstClassTime: "13:00",
      classDurationMinutes: 50,
      classesCount: 5,
      intervalStart: "15:40",
      intervalDurationMinutes: 15,
    },
    evening: {
      firstClassTime: "18:30",
      classDurationMinutes: 50,
      classesCount: 4,
      intervalStart: "19:20",
      intervalDurationMinutes: 10,
    },
  },
};

function mapPeriodFromRecord(record: Awaited<ReturnType<typeof prisma.systemRules.findUnique>>): SerializableSystemRules {
  if (!record) {
    return FALLBACK_RULES;
  }

  const periods = PERIOD_IDS.reduce((acc, period) => {
    acc[period] = extractPeriod(record, period);
    return acc;
  }, {} as SerializableSystemRules["periods"]);

  return {
    primaryColor: record.primaryColor,
    secondaryColor: record.secondaryColor,
    accentColor: record.accentColor,
    periods,
    updatedAt: record.updatedAt.toISOString(),
  };
}

function extractPeriod(
  record: NonNullable<Awaited<ReturnType<typeof prisma.systemRules.findUnique>>>,
  period: PeriodId,
) {
  switch (period) {
    case "morning":
      return {
        firstClassTime: formatMinutesToTime(record.morningFirstClassStart),
        classDurationMinutes: record.morningClassDurationMinutes,
        classesCount: record.morningClassesCount,
        intervalStart: formatMinutesToTime(record.morningIntervalStart),
        intervalDurationMinutes: record.morningIntervalDurationMinutes,
      };
    case "afternoon":
      return {
        firstClassTime: formatMinutesToTime(record.afternoonFirstClassStart),
        classDurationMinutes: record.afternoonClassDurationMinutes,
        classesCount: record.afternoonClassesCount,
        intervalStart: formatMinutesToTime(record.afternoonIntervalStart),
        intervalDurationMinutes: record.afternoonIntervalDurationMinutes,
      };
    case "evening":
      return {
        firstClassTime: formatMinutesToTime(record.eveningFirstClassStart),
        classDurationMinutes: record.eveningClassDurationMinutes,
        classesCount: record.eveningClassesCount,
        intervalStart: formatMinutesToTime(record.eveningIntervalStart),
        intervalDurationMinutes: record.eveningIntervalDurationMinutes,
      };
    default:
      return FALLBACK_RULES.periods[period];
  }
}

export async function getSystemRules(): Promise<SerializableSystemRules> {
  const record = await prisma.systemRules.findUnique({
    where: { id: SYSTEM_RULES_ID },
  });

  return mapPeriodFromRecord(record);
}
