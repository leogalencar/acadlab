"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Role } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  MINUTES_PER_DAY,
  SYSTEM_RULES_ID,
} from "@/features/system-rules/constants";
import {
  calculatePeriodEnd,
} from "@/features/system-rules/utils";
import type { SystemRulesActionState } from "@/features/system-rules/types";

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

const periodSchema = z
  .object({
    firstClassTime: timeSchema,
    classDurationMinutes: durationSchema,
    classesCount: classCountSchema,
    intervalStart: timeSchema,
    intervalDurationMinutes: intervalDurationSchema,
  })
  .superRefine((period, ctx) => {
    const sessionEndWithoutInterval =
      period.firstClassTime + period.classDurationMinutes * period.classesCount;

    if (period.intervalStart < period.firstClassTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["intervalStart"],
        message: "O intervalo deve iniciar após o início das aulas.",
      });
    }

    if (period.intervalStart > sessionEndWithoutInterval) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["intervalStart"],
        message: "O intervalo deve ocorrer durante as aulas do período.",
      });
    }

    const periodEnd = sessionEndWithoutInterval + period.intervalDurationMinutes;

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
    morning: periodSchema,
    afternoon: periodSchema,
    evening: periodSchema,
  })
  .superRefine((data, ctx) => {
    const morningEnd = calculatePeriodEnd(
      data.morning.firstClassTime,
      data.morning.classDurationMinutes,
      data.morning.classesCount,
      data.morning.intervalDurationMinutes,
    );

    const afternoonEnd = calculatePeriodEnd(
      data.afternoon.firstClassTime,
      data.afternoon.classDurationMinutes,
      data.afternoon.classesCount,
      data.afternoon.intervalDurationMinutes,
    );

    const eveningEnd = calculatePeriodEnd(
      data.evening.firstClassTime,
      data.evening.classDurationMinutes,
      data.evening.classesCount,
      data.evening.intervalDurationMinutes,
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
    primaryColor: formData.get("primaryColor"),
    secondaryColor: formData.get("secondaryColor"),
    accentColor: formData.get("accentColor"),
    morning: {
      firstClassTime: formData.get("morning.firstClassTime"),
      classDurationMinutes: formData.get("morning.classDurationMinutes"),
      classesCount: formData.get("morning.classesCount"),
      intervalStart: formData.get("morning.intervalStart"),
      intervalDurationMinutes: formData.get("morning.intervalDurationMinutes"),
    },
    afternoon: {
      firstClassTime: formData.get("afternoon.firstClassTime"),
      classDurationMinutes: formData.get("afternoon.classDurationMinutes"),
      classesCount: formData.get("afternoon.classesCount"),
      intervalStart: formData.get("afternoon.intervalStart"),
      intervalDurationMinutes: formData.get("afternoon.intervalDurationMinutes"),
    },
    evening: {
      firstClassTime: formData.get("evening.firstClassTime"),
      classDurationMinutes: formData.get("evening.classDurationMinutes"),
      classesCount: formData.get("evening.classesCount"),
      intervalStart: formData.get("evening.intervalStart"),
      intervalDurationMinutes: formData.get("evening.intervalDurationMinutes"),
    },
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Não foi possível validar as informações.";
    return { status: "error", message };
  }

  const data = parsed.data;

  const mapSystemRulesData = (rules: typeof data) => ({
    primaryColor: rules.primaryColor,
    secondaryColor: rules.secondaryColor,
    accentColor: rules.accentColor,
    morningFirstClassStart: rules.morning.firstClassTime,
    morningClassDurationMinutes: rules.morning.classDurationMinutes,
    morningClassesCount: rules.morning.classesCount,
    morningIntervalStart: rules.morning.intervalStart,
    morningIntervalDurationMinutes: rules.morning.intervalDurationMinutes,
    afternoonFirstClassStart: rules.afternoon.firstClassTime,
    afternoonClassDurationMinutes: rules.afternoon.classDurationMinutes,
    afternoonClassesCount: rules.afternoon.classesCount,
    afternoonIntervalStart: rules.afternoon.intervalStart,
    afternoonIntervalDurationMinutes: rules.afternoon.intervalDurationMinutes,
    eveningFirstClassStart: rules.evening.firstClassTime,
    eveningClassDurationMinutes: rules.evening.classDurationMinutes,
    eveningClassesCount: rules.evening.classesCount,
    eveningIntervalStart: rules.evening.intervalStart,
    eveningIntervalDurationMinutes: rules.evening.intervalDurationMinutes,
  });

  try {
    const mappedData = mapSystemRulesData(data);

    await prisma.systemRules.upsert({
      where: { id: SYSTEM_RULES_ID },
      update: mappedData,
      create: {
        id: SYSTEM_RULES_ID,
        ...mappedData,
      },
    });
  } catch (error) {
    console.error("[system-rules] Failed to update rules", error);
    return {
      status: "error",
      message: "Não foi possível salvar as regras do sistema. Tente novamente mais tarde.",
    };
  }

  revalidatePath("/system-rules");

  return {
    status: "success",
    message: "Regras do sistema atualizadas com sucesso.",
  };
}
