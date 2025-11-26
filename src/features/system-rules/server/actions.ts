"use server";

import { Buffer } from "node:buffer";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { Role } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createAuditSpan } from "@/lib/logging/audit";
import {
  DEFAULT_SYSTEM_RULES,
  MINUTES_PER_DAY,
  PERIOD_IDS,
  SUPPORTED_TIME_ZONES,
  SYSTEM_RULE_NAMES,
  type PeriodId,
} from "@/features/system-rules/constants";
import { calculatePeriodEnd } from "@/features/system-rules/utils";
import type { SystemRulesActionState } from "@/features/system-rules/types";
import { notifyEntityAction } from "@/features/notifications/server/triggers";

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

const academicPeriodLabelSchema = z
  .string()
  .trim()
  .min(3, "Informe o nome do período letivo.")
  .max(60, "O nome do período letivo deve ter no máximo 60 caracteres.");

const academicPeriodDurationSchema = z
  .coerce
  .number({ invalid_type_error: "Informe a duração do período em semanas." })
  .int("Utilize apenas números inteiros para a duração.")
  .min(1, "Defina ao menos 1 semana para o período letivo.")
  .max(52, "Defina no máximo 52 semanas para o período letivo.");

const academicPeriodDescriptionSchema = z
  .string()
  .trim()
  .max(160, "A descrição do período deve ter no máximo 160 caracteres.")
  .optional();

const timeZoneSchema = z
  .string()
  .refine((value) => SUPPORTED_TIME_ZONES.includes(value as (typeof SUPPORTED_TIME_ZONES)[number]), {
    message: "Selecione um fuso horário válido.",
  });

const institutionNameSchema = z
  .string()
  .trim()
  .min(2, "Informe o nome da instituição.")
  .max(80, "O nome da instituição deve ter no máximo 80 caracteres.");

const nonTeachingDaySchema = z
  .object({
    id: z.string().optional(),
    kind: z.enum(["specific-date", "weekday"]),
    date: z.string().optional(),
    weekDay: z.string().optional(),
    description: z.string().optional(),
    repeatsAnnually: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.kind === "specific-date") {
      if (!value.date || !/^\d{4}-\d{2}-\d{2}$/.test(value.date)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["date"],
          message: "Informe uma data válida no formato AAAA-MM-DD.",
        });
      }
      return;
    }

    if (value.kind === "weekday") {
      const weekDayNumber = Number.parseInt(value.weekDay ?? "", 10);
      if (!Number.isInteger(weekDayNumber) || weekDayNumber < 0 || weekDayNumber > 6) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["weekDay"],
          message: "Selecione um dia da semana válido.",
        });
      }
    }
  });

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

    if (orderedIntervals.length > 0) {
      let timelineCursor = period.firstClassTime;
      let intervalCursor = 0;

      for (let classIndex = 0; classIndex < period.classesCount; classIndex += 1) {
        const classStart = timelineCursor;
        const classEnd = classStart + period.classDurationMinutes;

        while (intervalCursor < orderedIntervals.length) {
          const intervalEntry = orderedIntervals[intervalCursor]!;

          if (intervalEntry.interval.start <= classStart) {
            intervalCursor += 1;
            continue;
          }

          if (intervalEntry.interval.start < classEnd) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["intervals", intervalEntry.index, "start"],
              message: "Os intervalos não podem começar durante uma aula.",
            });
            intervalCursor += 1;
            continue;
          }

          break;
        }

        timelineCursor = classEnd;

        while (
          intervalCursor < orderedIntervals.length &&
          orderedIntervals[intervalCursor]!.interval.start === timelineCursor
        ) {
          const intervalEntry = orderedIntervals[intervalCursor]!;
          timelineCursor += intervalEntry.interval.durationMinutes;
          intervalCursor += 1;
        }
      }

      while (intervalCursor < orderedIntervals.length) {
        const intervalEntry = orderedIntervals[intervalCursor]!;
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["intervals", intervalEntry.index, "start"],
          message: "Os intervalos devem ocorrer entre as aulas configuradas.",
        });
        intervalCursor += 1;
      }
    }

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
    successColor: colorSchema,
    warningColor: colorSchema,
    infoColor: colorSchema,
    dangerColor: colorSchema,
    allowedEmailDomains: emailDomainListSchema,
    timeZone: timeZoneSchema,
    preventConcurrentTeacherReservations: z.boolean(),
    institutionName: institutionNameSchema,
    nonTeachingDays: z
      .array(nonTeachingDaySchema)
      .max(120, "Cadastre no máximo 120 dias não letivos."),
    classPeriodLabel: academicPeriodLabelSchema,
    classPeriodDurationWeeks: academicPeriodDurationSchema,
    classPeriodDescription: academicPeriodDescriptionSchema,
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

  const audit = createAuditSpan(
    {
      module: "system-rules",
      action: "updateSystemRulesAction",
      actorId: session?.user?.id,
      actorRole: session?.user?.role,
    },
    { fieldCount: Array.from(formData.keys()).length },
    "Received request to update system rules",
    { importance: "high", persist: true },
  );

  if (!session?.user) {
    audit.validationFailure({ reason: "not_authenticated" });
    return { status: "error", message: "Você precisa estar autenticado." };
  }

  if (session.user.role !== Role.ADMIN) {
    audit.validationFailure({ reason: "forbidden", role: session.user.role });
    return {
      status: "error",
      message: "Apenas administradores podem editar as regras do sistema.",
    };
  }

  const nonTeachingDaysForm = extractNonTeachingDays(formData);

  const parsed = systemRulesSchema.safeParse({
    primaryColor: getStringValue(formData, "primaryColor"),
    secondaryColor: getStringValue(formData, "secondaryColor"),
    accentColor: getStringValue(formData, "accentColor"),
    successColor: getStringValue(formData, "successColor"),
    warningColor: getStringValue(formData, "warningColor"),
    infoColor: getStringValue(formData, "infoColor"),
    dangerColor: getStringValue(formData, "dangerColor"),
    allowedEmailDomains: extractAllowedDomains(formData),
    timeZone: getStringValue(formData, "timeZone"),
    preventConcurrentTeacherReservations: getCheckboxValue(
      formData,
      "preventConcurrentTeacherReservations",
    ),
    institutionName: getStringValue(formData, "institutionName"),
    nonTeachingDays: nonTeachingDaysForm,
    classPeriodLabel: getStringValue(formData, "classPeriodLabel"),
    classPeriodDurationWeeks: getStringValue(formData, "classPeriodDurationWeeks"),
    classPeriodDescription: getStringValue(formData, "classPeriodDescription"),
    morning: buildPeriodFormPayload(formData, "morning"),
    afternoon: buildPeriodFormPayload(formData, "afternoon"),
    evening: buildPeriodFormPayload(formData, "evening"),
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Não foi possível validar as informações.";
    audit.validationFailure({ reason: "invalid_payload", issues: parsed.error.issues.length });
    return { status: "error", message };
  }

  const data = parsed.data;

  const brandingRecord = await audit.trackPrisma(
    { model: "systemRule", action: "findUnique", targetIds: SYSTEM_RULE_NAMES.BRANDING },
    () =>
      prisma.systemRule.findUnique({
        where: { name: SYSTEM_RULE_NAMES.BRANDING },
        select: { value: true },
      }),
  );

  const currentBranding = parseBrandingRecord(brandingRecord?.value) ?? DEFAULT_SYSTEM_RULES.branding;

  const rawLogoAction = getStringValue(formData, "logoAction");
  const resolvedLogoAction = resolveLogoAction(rawLogoAction);

  let logoUrlForPersistence: string | null | undefined;

  if (resolvedLogoAction === "replace") {
    const file = formData.get("logoFile");

    if (!(file instanceof File) || file.size === 0) {
      audit.validationFailure({ reason: "invalid_logo_file" });
      return { status: "error", message: "Selecione um arquivo de imagem válido para o logotipo." };
    }

    if (file.size > 256_000) {
      audit.validationFailure({ reason: "logo_too_large", size: file.size });
      return { status: "error", message: "O logotipo deve ter no máximo 256 KB." };
    }

    if (!isSupportedImageType(file.type)) {
      audit.validationFailure({ reason: "unsupported_logo_type", type: file.type });
      return {
        status: "error",
        message: "Utilize um arquivo PNG, JPG ou SVG para o logotipo.",
      };
    }

    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      logoUrlForPersistence = `data:${file.type};base64,${buffer.toString("base64")}`;
    } catch (error) {
      audit.failure(error, { stage: "process_logo_upload" });
      return {
        status: "error",
        message: "Não foi possível processar o arquivo de logotipo enviado.",
      };
    }
  } else if (resolvedLogoAction === "remove") {
    logoUrlForPersistence = null;
  }

  const colorsPayload = {
    primaryColor: data.primaryColor,
    secondaryColor: data.secondaryColor,
    accentColor: data.accentColor,
    successColor: data.successColor,
    warningColor: data.warningColor,
    infoColor: data.infoColor,
    dangerColor: data.dangerColor,
  };

  const normalizedEmailDomains = Array.from(new Set(data.allowedEmailDomains));

  const emailDomainsPayload = {
    domains: normalizedEmailDomains,
  };

  const nonTeachingDaysPayload = buildNonTeachingDayPayload(data.nonTeachingDays);
  const academicPeriodPayload = {
    label: data.classPeriodLabel.trim(),
    durationWeeks: data.classPeriodDurationWeeks,
    description:
      data.classPeriodDescription && data.classPeriodDescription.trim().length > 0
        ? data.classPeriodDescription.trim()
        : undefined,
  };

  const schedulePayload = {
    timeZone: data.timeZone,
    preventConcurrentTeacherReservations: data.preventConcurrentTeacherReservations,
    periods: PERIOD_IDS.reduce(
      (accumulator, period) => {
        accumulator[period] = mapPeriodForPersistence(data[period]);
        return accumulator;
      },
      {} as Record<PeriodId, ReturnType<typeof mapPeriodForPersistence>>,
    ),
    nonTeachingDays: nonTeachingDaysPayload,
    academicPeriod: academicPeriodPayload,
  };

  const brandingPayload = {
    institutionName: data.institutionName.trim(),
    logoUrl: logoUrlForPersistence ?? currentBranding.logoUrl ?? null,
  };

  try {
    await audit.trackPrisma(
      { model: "systemRule", action: "$transaction", meta: { operations: 4 } },
      () =>
        prisma.$transaction([
          prisma.systemRule.upsert({
            where: { name: SYSTEM_RULE_NAMES.COLORS },
            update: { value: colorsPayload },
            create: {
              name: SYSTEM_RULE_NAMES.COLORS,
          value: colorsPayload,
        },
      }),
      prisma.systemRule.upsert({
        where: { name: SYSTEM_RULE_NAMES.BRANDING },
        update: { value: brandingPayload },
        create: {
          name: SYSTEM_RULE_NAMES.BRANDING,
          value: brandingPayload,
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
        ]),
    );
  } catch (error) {
    audit.failure(error, { stage: "persist_rules" });
    return {
      status: "error",
      message: "Não foi possível salvar as regras do sistema. Tente novamente mais tarde.",
    };
  }

  await notifyEntityAction({
    userId: session.user.id,
    entity: "Regras do sistema",
    entityName: data.institutionName.trim(),
    href: "/system-rules",
    type: "update",
  });

  revalidateTag("system-rules");
  revalidatePath("/system-rules");
  revalidatePath("/", "layout");
  revalidatePath("/users");

  audit.success({ institution: data.institutionName.trim() }, "Regras do sistema atualizadas");

  return {
    status: "success",
    message: "Regras do sistema atualizadas com sucesso.",
  };
}

type PeriodSchemaOutput = z.infer<typeof periodSchema>;
type NonTeachingDaySchemaOutput = z.infer<typeof nonTeachingDaySchema>;

function getStringValue(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  return typeof value === "string" ? value : undefined;
}

function getCheckboxValue(formData: FormData, name: string): boolean {
  const values = formData.getAll(name);
  return values.some((value) =>
    typeof value === "string" ? value === "on" || value.toLowerCase() === "true" : false,
  );
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

function extractNonTeachingDays(formData: FormData) {
  type EntryRecord = {
    id?: string;
    kind?: string;
    date?: string;
    weekDay?: string;
    description?: string;
    repeatsAnnually?: string;
  };

  const prefix = "nonTeachingDays.";
  const entries = new Map<number, EntryRecord>();

  for (const [key, rawValue] of formData.entries()) {
    if (typeof rawValue !== "string" || !key.startsWith(prefix)) {
      continue;
    }

    const match = key.slice(prefix.length).match(/^(\d+)\.(id|kind|date|weekDay|description|repeatsAnnually)$/);

    if (!match) {
      continue;
    }

    const index = Number.parseInt(match[1] ?? "", 10);

    if (!Number.isFinite(index)) {
      continue;
    }

    const field = match[2] as keyof EntryRecord;
    const record = entries.get(index) ?? {};

    record[field] = rawValue;
    entries.set(index, record);
  }

  return Array.from(entries.entries())
    .sort((left, right) => left[0] - right[0])
    .map(([, record]) => ({
      id: record.id,
      kind: record.kind,
      date: record.date,
      weekDay: record.weekDay,
      description: record.description,
      repeatsAnnually: coerceCheckboxValue(record.repeatsAnnually),
    }))
    .filter((entry) => typeof entry.kind === "string");
}

function coerceCheckboxValue(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.toLowerCase();
  return normalized === "on" || normalized === "true" || normalized === "1" || normalized === "yes";
}

function buildNonTeachingDayPayload(entries: NonTeachingDaySchemaOutput[]) {
  const normalized: Array<{
    id?: string;
    kind: "specific-date" | "weekday";
    date?: string;
    weekDay?: number;
    description?: string;
    repeatsAnnually?: boolean;
  }> = [];

  const seen = new Set<string>();

  for (const entry of entries) {
    if (entry.kind === "weekday") {
      const weekDayNumber = Number.parseInt(entry.weekDay ?? "0", 10);
      const key = `weekday-${weekDayNumber}`;

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      normalized.push({
        id: entry.id ?? undefined,
        kind: "weekday",
        weekDay: weekDayNumber,
        description: sanitizeDescription(entry.description),
      });
      continue;
    }

    if (!entry.date) {
      continue;
    }

    const annualKey = entry.repeatsAnnually ? entry.date.slice(5) : entry.date;
    const key = `date-${entry.repeatsAnnually ? `annual-${annualKey}` : annualKey}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalized.push({
      id: entry.id ?? undefined,
      kind: "specific-date",
      date: entry.date,
      description: sanitizeDescription(entry.description),
      repeatsAnnually: entry.repeatsAnnually ? true : undefined,
    });
  }

  return normalized;
}

function sanitizeDescription(description?: string) {
  if (!description) {
    return undefined;
  }

  const trimmed = description.trim();

  if (!trimmed) {
    return undefined;
  }

  return trimmed.length > 120 ? `${trimmed.slice(0, 117)}...` : trimmed;
}

function resolveLogoAction(value?: string | null): "keep" | "remove" | "replace" {
  if (value === "remove" || value === "replace") {
    return value;
  }
  return "keep";
}

const ALLOWED_LOGO_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/svg+xml"]);

function isSupportedImageType(type: string | undefined) {
  return typeof type === "string" && ALLOWED_LOGO_MIME_TYPES.has(type);
}

function parseBrandingRecord(value: unknown) {
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
