"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Role } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  MINUTES_PER_DAY,
  PERIOD_IDS,
  SYSTEM_RULE_NAMES,
  type PeriodId,
} from "@/features/system-rules/constants";
import { calculatePeriodEnd } from "@/features/system-rules/utils";
import type { SystemRulesActionState } from "@/features/system-rules/types";

const SUPPORTED_TIME_ZONES =
  typeof Intl.supportedValuesOf === "function"
    ? new Set(Intl.supportedValuesOf("timeZone"))
    : null;

const colorSchema = z
  .string()
  .trim()
  .min(1, "Informe uma cor hexadecimal no formato #RRGGBB.")
  .transform((value) => value.toUpperCase())
  .refine((value) => /^#[0-9A-F]{6}$/.test(value), {
    message: "Informe uma cor hexadecimal no formato #RRGGBB.",
  });

const timeSchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: "Informe um horário válido no formato HH:MM.",
  })
  .transform((value) => {
    const [hours, minutes] = value.split(":").map(Number);
    return hours * 60 + minutes;
  });

const durationSchema = z
  .coerce
  .number({ invalid_type_error: "Informe a duração em minutos." })
  .int("Utilize apenas números inteiros para a duração.")
  .min(10, "A duração de cada aula deve ser de pelo menos 10 minutos.")
  .max(240, "A duração de cada aula deve ser de no máximo 240 minutos.");

const classCountSchema = z
  .coerce
  .number({ invalid_type_error: "Informe a quantidade de aulas." })
  .int("Utilize apenas números inteiros para a quantidade de aulas.")
  .min(1, "Cada período deve ter pelo menos uma aula.")
  .max(12, "Defina no máximo 12 aulas por período.");

const intervalDurationSchema = z
  .coerce
  .number({ invalid_type_error: "Informe a duração do intervalo em minutos." })
  .int("Utilize apenas números inteiros para a duração do intervalo.")
  .min(0, "A duração do intervalo não pode ser negativa.")
  .max(180, "A duração do intervalo deve ser menor que 3 horas.");

const intervalSchema = z.object({
  start: timeSchema,
  durationMinutes: intervalDurationSchema,
});

const timeZoneSchema = z
  .string()
  .trim()
  .min(1, "Selecione um fuso horário válido.")
  .transform((value) => value)
  .refine(
    (value) => {
      if (!SUPPORTED_TIME_ZONES) {
        return true;
      }
      return SUPPORTED_TIME_ZONES.has(value);
    },
    {
      message: "Selecione um fuso horário válido.",
    },
  );

const isoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: "Informe a data no formato AAAA-MM-DD.",
  });

const academicPeriodTypeSchema = z.enum([
  "BIMESTER",
  "TRIMESTER",
  "SEMESTER",
  "ANNUAL",
  "CUSTOM",
] as const);

const academicPeriodSchema = z
  .object({
    id: z.string().min(1, "Identificador do período ausente."),
    name: z.string().trim().min(1, "Informe o nome do período letivo."),
    type: academicPeriodTypeSchema,
    startDate: isoDateSchema,
    endDate: isoDateSchema,
  })
  .refine(
    (period) => period.startDate <= period.endDate,
    {
      message: "A data de término deve ser posterior à data de início.",
      path: ["endDate"],
    },
  );

const academicPeriodsSchema = z
  .array(academicPeriodSchema)
  .max(20, "Cadastre no máximo 20 períodos letivos.");

const emailDomainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

const emailDomainSchema = z
  .string()
  .trim()
  .min(1, "Informe um domínio de e-mail.")
  .transform((value) => value.toLowerCase())
  .refine((value) => emailDomainRegex.test(value), {
    message: "Informe um domínio válido (ex.: fatec.sp.gov.br).",
  });

const emailDomainListSchema = z
  .array(emailDomainSchema)
  .min(1, "Defina ao menos um domínio de e-mail permitido.")
  .max(20, "Cadastre no máximo 20 domínios permitidos.");

const periodSchema = z
  .object({
    firstClassTime: timeSchema,
    classDurationMinutes: durationSchema,
    classesCount: classCountSchema,
    intervals: z
      .array(intervalSchema)
      .max(6, "Defina no máximo 6 intervalos por período."),
  })
  .superRefine((period, ctx) => {
    const sessionEndWithoutIntervals =
      period.firstClassTime + period.classDurationMinutes * period.classesCount;

    const periodEnd = calculatePeriodEnd(
      period.firstClassTime,
      period.classDurationMinutes,
      period.classesCount,
      period.intervals,
    );

    const orderedIntervals = period.intervals
      .map((interval, index) => ({ interval, index }))
      .sort((left, right) => left.interval.start - right.interval.start);

    orderedIntervals.forEach(({ interval, index }, position) => {
      if (interval.start < period.firstClassTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["intervals", index, "start"],
          message: "Os intervalos devem iniciar após o começo das aulas.",
        });
      }

      if (interval.start > sessionEndWithoutIntervals) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["intervals", index, "start"],
          message: "Os intervalos precisam ocorrer durante o período letivo informado.",
        });
      }

      if (interval.start + interval.durationMinutes > MINUTES_PER_DAY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["intervals", index, "durationMinutes"],
          message: "Os intervalos devem terminar antes do fim do dia.",
        });
      }

      if (interval.start + interval.durationMinutes > periodEnd) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["intervals", index, "durationMinutes"],
          message: "A duração total do período não comporta este intervalo.",
        });
      }

      if (position > 0) {
        const previous = orderedIntervals[position - 1];
        const previousEnd =
          previous.interval.start + previous.interval.durationMinutes;

        if (interval.start < previousEnd) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["intervals", index, "start"],
            message: "Os intervalos não podem se sobrepor.",
          });
        }
      }
    });

    if (periodEnd > MINUTES_PER_DAY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["firstClassTime"],
        message: "Os horários do período ultrapassam o limite de 24 horas do dia.",
      });
    }
  });

const systemRulesSchema = z
  .object({
    primaryColor: colorSchema,
    secondaryColor: colorSchema,
    accentColor: colorSchema,
    allowedEmailDomains: emailDomainListSchema,
    timeZone: timeZoneSchema,
    academicPeriods: academicPeriodsSchema,
    morning: periodSchema,
    afternoon: periodSchema,
    evening: periodSchema,
  })
  .superRefine((data, ctx) => {
    const morningEnd = calculatePeriodEnd(
      data.morning.firstClassTime,
      data.morning.classDurationMinutes,
      data.morning.classesCount,
      data.morning.intervals,
    );

    const afternoonEnd = calculatePeriodEnd(
      data.afternoon.firstClassTime,
      data.afternoon.classDurationMinutes,
      data.afternoon.classesCount,
      data.afternoon.intervals,
    );

    const eveningEnd = calculatePeriodEnd(
      data.evening.firstClassTime,
      data.evening.classDurationMinutes,
      data.evening.classesCount,
      data.evening.intervals,
    );

    if (data.morning.firstClassTime >= data.afternoon.firstClassTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["afternoon", "firstClassTime"],
        message: "O período da tarde deve iniciar após o período da manhã.",
      });
    }

    if (morningEnd > data.afternoon.firstClassTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["afternoon", "firstClassTime"],
        message: "As aulas da manhã não podem avançar sobre o início da tarde.",
      });
    }

    if (data.afternoon.firstClassTime >= data.evening.firstClassTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["evening", "firstClassTime"],
        message: "O período da noite deve iniciar após o período da tarde.",
      });
    }

    if (afternoonEnd > data.evening.firstClassTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["evening", "firstClassTime"],
        message: "As aulas da tarde não podem avançar sobre o início da noite.",
      });
    }

    if (eveningEnd > MINUTES_PER_DAY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["evening", "firstClassTime"],
        message: "Os horários da noite devem encerrar antes das 24h.",
      });
    }
  });

export async function updateSystemRulesAction(
  _prevState: SystemRulesActionState,
  formData: FormData,
): Promise<SystemRulesActionState> {
  const session = await auth();

  if (!session?.user) {
    return { status: "error", message: "Você precisa estar autenticado." };
  }

  if (session.user.role !== Role.ADMIN) {
    return {
      status: "error",
      message: "Apenas administradores podem editar as regras do sistema.",
    };
  }

  const parsed = systemRulesSchema.safeParse({
    primaryColor: getStringValue(formData, "primaryColor"),
    secondaryColor: getStringValue(formData, "secondaryColor"),
    accentColor: getStringValue(formData, "accentColor"),
    allowedEmailDomains: extractAllowedDomains(formData),
    timeZone: getStringValue(formData, "timeZone"),
    academicPeriods: parseAcademicPeriodsField(formData),
    morning: buildPeriodFormPayload(formData, "morning"),
    afternoon: buildPeriodFormPayload(formData, "afternoon"),
    evening: buildPeriodFormPayload(formData, "evening"),
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Não foi possível validar as informações.";
    return { status: "error", message };
  }

  const data = parsed.data;

  const colorsPayload = {
    primaryColor: data.primaryColor,
    secondaryColor: data.secondaryColor,
    accentColor: data.accentColor,
  };

  const normalizedEmailDomains = Array.from(new Set(data.allowedEmailDomains));

  const emailDomainsPayload = {
    domains: normalizedEmailDomains,
  };

  const schedulePayload = {
    timeZone: data.timeZone,
    academicPeriods: data.academicPeriods.map((period) => ({
      id: period.id,
      name: period.name,
      type: period.type,
      startDate: period.startDate,
      endDate: period.endDate,
    })),
    periods: PERIOD_IDS.reduce(
      (accumulator, period) => {
        accumulator[period] = mapPeriodForPersistence(data[period]);
        return accumulator;
      },
      {} as Record<PeriodId, ReturnType<typeof mapPeriodForPersistence>>,
    ),
  };

  try {
    await prisma.$transaction([
      prisma.systemRule.upsert({
        where: { name: SYSTEM_RULE_NAMES.COLORS },
        update: { value: colorsPayload },
        create: {
          name: SYSTEM_RULE_NAMES.COLORS,
          value: colorsPayload,
        },
      }),
      prisma.systemRule.upsert({
        where: { name: SYSTEM_RULE_NAMES.SCHEDULE },
        update: { value: schedulePayload },
        create: {
          name: SYSTEM_RULE_NAMES.SCHEDULE,
          value: schedulePayload,
        },
      }),
      prisma.systemRule.upsert({
        where: { name: SYSTEM_RULE_NAMES.EMAIL_DOMAINS },
        update: { value: emailDomainsPayload },
        create: {
          name: SYSTEM_RULE_NAMES.EMAIL_DOMAINS,
          value: emailDomainsPayload,
        },
      }),
    ]);
  } catch (error) {
    console.error("[system-rules] Failed to update rules", error);
    return {
      status: "error",
      message: "Não foi possível salvar as regras do sistema. Tente novamente mais tarde.",
    };
  }

  revalidatePath("/system-rules");
  revalidatePath("/", "layout");
  revalidatePath("/users");

  return {
    status: "success",
    message: "Regras do sistema atualizadas com sucesso.",
  };
}

type PeriodSchemaOutput = z.infer<typeof periodSchema>;

function getStringValue(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  return typeof value === "string" ? value : undefined;
}

function buildPeriodFormPayload(formData: FormData, period: PeriodId) {
  return {
    firstClassTime: getStringValue(formData, `${period}.firstClassTime`),
    classDurationMinutes: getStringValue(formData, `${period}.classDurationMinutes`),
    classesCount: getStringValue(formData, `${period}.classesCount`),
    intervals: extractIntervalFormValues(formData, period),
  };
}

function extractIntervalFormValues(formData: FormData, period: PeriodId) {
  const prefix = `${period}.intervals.`;
  const intervals = new Map<number, { start?: string; durationMinutes?: string }>();

  for (const [key, rawValue] of formData.entries()) {
    if (typeof rawValue !== "string" || !key.startsWith(prefix)) {
      continue;
    }

    const match = key.slice(prefix.length).match(/^(\d+)\.(start|durationMinutes)$/);

    if (!match) {
      continue;
    }

    const index = Number.parseInt(match[1] ?? "", 10);

    if (!Number.isFinite(index)) {
      continue;
    }

    const field = match[2] as "start" | "durationMinutes";
    const record = intervals.get(index) ?? {};

    record[field] = rawValue;
    intervals.set(index, record);
  }

  return Array.from(intervals.entries())
    .sort((left, right) => left[0] - right[0])
    .map(([, record]) => ({
      start: record.start ?? "",
      durationMinutes: record.durationMinutes ?? "",
    }));
}

function parseAcademicPeriodsField(formData: FormData) {
  const raw = formData.get("academicPeriods");

  if (typeof raw !== "string") {
    return [];
  }

  const trimmed = raw.trim();

  if (trimmed.length === 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function extractAllowedDomains(formData: FormData): string[] {
  return formData
    .getAll("allowedEmailDomains")
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);
}

function mapPeriodForPersistence(period: PeriodSchemaOutput) {
  return {
    firstClassTime: period.firstClassTime,
    classDurationMinutes: period.classDurationMinutes,
    classesCount: period.classesCount,
    intervals: [...period.intervals]
      .sort((left, right) => left.start - right.start)
      .map((interval) => ({
        start: interval.start,
        durationMinutes: interval.durationMinutes,
      })),
  };
}
