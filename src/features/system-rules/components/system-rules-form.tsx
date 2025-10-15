"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PERIOD_IDS, type PeriodId } from "@/features/system-rules/constants";
import { updateSystemRulesAction } from "@/features/system-rules/server/actions";
import type { SerializableSystemRules } from "@/features/system-rules/types";

const FORM_INITIAL_STATE = { status: "idle" as const };

const PERIOD_METADATA: Record<PeriodId, { title: string; description: string }> = {
  morning: {
    title: "Período da manhã",
    description:
      "Defina o horário de início, duração e intervalos das aulas realizadas no período matutino.",
  },
  afternoon: {
    title: "Período da tarde",
    description:
      "Configure o turno vespertino garantindo que não haja conflitos com as aulas da manhã.",
  },
  evening: {
    title: "Período da noite",
    description:
      "Ajuste o turno noturno respeitando os limites do dia e o encerramento do período da tarde.",
  },
};

interface SystemRulesFormProps {
  rules: SerializableSystemRules;
}

interface ColorState {
  primary: string;
  secondary: string;
  accent: string;
}

interface IntervalFormState {
  id: string;
  start: string;
  durationMinutes: string;
}

type PeriodIntervalsState = Record<PeriodId, IntervalFormState[]>;

type IntervalField = keyof Pick<IntervalFormState, "start" | "durationMinutes">;

export function SystemRulesForm({ rules }: SystemRulesFormProps) {
  const [state, formAction] = useFormState(updateSystemRulesAction, FORM_INITIAL_STATE);

  const [colors, setColors] = useState<ColorState>(() => createColorState(rules));
  const [intervalsByPeriod, setIntervalsByPeriod] = useState<PeriodIntervalsState>(() =>
    createIntervalsState(rules),
  );

  useEffect(() => {
    setColors(createColorState(rules));
    setIntervalsByPeriod(createIntervalsState(rules));
  }, [rules]);

  const lastUpdatedLabel = useMemo(() => {
    if (!rules.updatedAt) {
      return null;
    }

    try {
      const formatter = new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "long",
        timeStyle: "short",
      });
      return formatter.format(new Date(rules.updatedAt));
    } catch {
      return null;
    }
  }, [rules.updatedAt]);

  const handleColorChange = (key: keyof ColorState) => (nextValue: string) => {
    setColors((previous) => ({
      ...previous,
      [key]: normalizeHexColor(nextValue),
    }));
  };

  const handleIntervalChange = (
    period: PeriodId,
    intervalId: string,
    field: IntervalField,
    value: string,
  ) => {
    setIntervalsByPeriod((previous) => ({
      ...previous,
      [period]: previous[period].map((interval) =>
        interval.id === intervalId ? { ...interval, [field]: value } : interval,
      ),
    }));
  };

  const handleAddInterval = (period: PeriodId) => {
    setIntervalsByPeriod((previous) => {
      const existing = previous[period];
      const lastInterval = existing.at(-1);

      const nextInterval: IntervalFormState = {
        id: generateIntervalId(period),
        start: lastInterval?.start ?? rules.periods[period].firstClassTime,
        durationMinutes: lastInterval?.durationMinutes ?? "15",
      };

      return {
        ...previous,
        [period]: [...existing, nextInterval],
      };
    });
  };

  const handleRemoveInterval = (period: PeriodId, intervalId: string) => {
    setIntervalsByPeriod((previous) => ({
      ...previous,
      [period]: previous[period].filter((interval) => interval.id !== intervalId),
    }));
  };

  return (
    <form className="space-y-8" action={formAction}>
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Identidade visual do sistema</CardTitle>
          <CardDescription>
            Defina as cores que serão utilizadas em botões, links e destaques da interface.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-3">
          <ColorField
            id="primaryColor"
            name="primaryColor"
            label="Cor primária"
            description="Aplicada em botões principais e elementos de maior destaque."
            value={colors.primary}
            onValueChange={handleColorChange("primary")}
          />
          <ColorField
            id="secondaryColor"
            name="secondaryColor"
            label="Cor secundária"
            description="Utilizada em barras, cabeçalhos e elementos complementares."
            value={colors.secondary}
            onValueChange={handleColorChange("secondary")}
          />
          <ColorField
            id="accentColor"
            name="accentColor"
            label="Cor de destaque"
            description="Aparece em links, indicadores e mensagens informativas."
            value={colors.accent}
            onValueChange={handleColorChange("accent")}
          />
        </CardContent>
      </Card>

      <div className="space-y-6">
        {PERIOD_IDS.map((period) => {
          const metadata = PERIOD_METADATA[period];
          const periodRules = rules.periods[period];
          const intervalState = intervalsByPeriod[period] ?? [];

          return (
            <Card key={period}>
              <CardHeader>
                <CardTitle className="text-xl">{metadata.title}</CardTitle>
                <CardDescription>{metadata.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor={`${period}.firstClassTime`}>
                      Início da primeira aula
                    </Label>
                    <Input
                      id={`${period}.firstClassTime`}
                      name={`${period}.firstClassTime`}
                      type="time"
                      required
                      step={300}
                      defaultValue={periodRules.firstClassTime}
                    />
                    <HelperText>
                      Informe o horário em formato 24 horas (ex.: 07:00).
                    </HelperText>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${period}.classDurationMinutes`}>
                      Duração de cada aula (minutos)
                    </Label>
                    <Input
                      id={`${period}.classDurationMinutes`}
                      name={`${period}.classDurationMinutes`}
                      type="number"
                      min={10}
                      max={240}
                      required
                      defaultValue={periodRules.classDurationMinutes}
                    />
                    <HelperText>
                      Defina a duração padronizada das aulas neste período.
                    </HelperText>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${period}.classesCount`}>
                      Quantidade de aulas
                    </Label>
                    <Input
                      id={`${period}.classesCount`}
                      name={`${period}.classesCount`}
                      type="number"
                      min={1}
                      max={12}
                      required
                      defaultValue={periodRules.classesCount}
                    />
                    <HelperText>
                      Quantidade total de aulas previstas para o período.
                    </HelperText>
                  </div>
                </div>

                <IntervalSection
                  period={period}
                  intervals={intervalState}
                  onIntervalChange={handleIntervalChange}
                  onIntervalRemove={handleRemoveInterval}
                  onAddInterval={handleAddInterval}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {state.status === "error" ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {state.message ?? "Não foi possível salvar as regras do sistema."}
        </div>
      ) : null}

      {state.status === "success" ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-800 dark:text-emerald-100">
          {state.message}
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-muted-foreground">
          {lastUpdatedLabel ? (
            <p>Última atualização registrada em {lastUpdatedLabel}.</p>
          ) : (
            <p>Os ajustes são aplicados imediatamente após a confirmação.</p>
          )}
        </div>
        <SaveButton />
      </div>
    </form>
  );
}

interface ColorFieldProps {
  id: string;
  name: string;
  label: string;
  description: string;
  value: string;
  onValueChange: (value: string) => void;
}

function ColorField({ id, name, label, description, value, onValueChange }: ColorFieldProps) {
  const [textValue, setTextValue] = useState(value);

  useEffect(() => {
    setTextValue(value);
  }, [value]);

  const handleBlur = () => {
    const candidate = textValue.trim().toUpperCase();

    if (/^#[0-9A-F]{6}$/.test(candidate)) {
      onValueChange(candidate);
    } else {
      setTextValue(value);
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={`${id}-text`}>{label}</Label>
      <div className="flex items-center gap-3">
        <input
          id={`${id}-picker`}
          name={name}
          type="color"
          value={value}
          aria-label={`Selecionar ${label.toLowerCase()}`}
          className="size-10 shrink-0 cursor-pointer rounded-md border border-border/70 bg-transparent p-0"
          onChange={(event) => onValueChange(event.currentTarget.value.toUpperCase())}
        />
        <Input
          id={`${id}-text`}
          value={textValue}
          onChange={(event) => setTextValue(event.currentTarget.value.toUpperCase())}
          onBlur={handleBlur}
          maxLength={7}
          spellCheck={false}
          autoComplete="off"
          pattern="^#[0-9A-F]{6}$"
          aria-describedby={`${id}-description`}
          placeholder="#000000"
        />
      </div>
      <HelperText id={`${id}-description`}>{description}</HelperText>
    </div>
  );
}

interface IntervalSectionProps {
  period: PeriodId;
  intervals: IntervalFormState[];
  onIntervalChange: (
    period: PeriodId,
    intervalId: string,
    field: IntervalField,
    value: string,
  ) => void;
  onIntervalRemove: (period: PeriodId, intervalId: string) => void;
  onAddInterval: (period: PeriodId) => void;
}

function IntervalSection({
  period,
  intervals,
  onIntervalChange,
  onIntervalRemove,
  onAddInterval,
}: IntervalSectionProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <p className="text-sm font-medium">Intervalos cadastrados</p>
        <HelperText>
          Cadastre um ou mais intervalos para este período. Utilize o botão para adicionar novos
          horários e defina a duração de cada pausa.
        </HelperText>
      </div>

      <div className="space-y-3">
        {intervals.length > 0 ? (
          intervals.map((interval, index) => (
            <div
              key={interval.id}
              className="grid gap-3 rounded-md border border-border/60 p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
            >
              <div className="space-y-1">
                <Label htmlFor={`${period}.intervals.${index}.start`}>Início do intervalo</Label>
                <Input
                  id={`${period}.intervals.${index}.start`}
                  name={`${period}.intervals.${index}.start`}
                  type="time"
                  required
                  step={300}
                  value={interval.start}
                  onChange={(event) =>
                    onIntervalChange(period, interval.id, "start", event.currentTarget.value)
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`${period}.intervals.${index}.durationMinutes`}>
                  Duração (min)
                </Label>
                <Input
                  id={`${period}.intervals.${index}.durationMinutes`}
                  name={`${period}.intervals.${index}.durationMinutes`}
                  type="number"
                  min={0}
                  max={180}
                  required
                  value={interval.durationMinutes}
                  onChange={(event) =>
                    onIntervalChange(period, interval.id, "durationMinutes", event.currentTarget.value)
                  }
                />
              </div>
              <div className="flex items-end justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => onIntervalRemove(period, interval.id)}
                  aria-label="Remover intervalo"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-md border border-dashed border-border/70 p-4 text-xs text-muted-foreground">
            Nenhum intervalo cadastrado. Utilize o botão abaixo para adicionar o primeiro intervalo.
          </div>
        )}
      </div>

      <Button type="button" variant="outline" onClick={() => onAddInterval(period)}>
        <Plus className="size-4" />
        Adicionar intervalo
      </Button>
    </div>
  );
}

interface HelperTextProps {
  id?: string;
  children: ReactNode;
}

function HelperText({ id, children }: HelperTextProps) {
  return (
    <p id={id} className="text-xs text-muted-foreground">
      {children}
    </p>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-full sm:w-auto" disabled={pending}>
      {pending ? "Salvando alterações..." : "Salvar regras"}
    </Button>
  );
}

function createColorState(rules: SerializableSystemRules): ColorState {
  return {
    primary: rules.primaryColor.toUpperCase(),
    secondary: rules.secondaryColor.toUpperCase(),
    accent: rules.accentColor.toUpperCase(),
  };
}

function createIntervalsState(rules: SerializableSystemRules): PeriodIntervalsState {
  return PERIOD_IDS.reduce((accumulator, period) => {
    const periodRules = rules.periods[period];

    accumulator[period] = periodRules.intervals.map((interval) => ({
      id: generateIntervalId(period),
      start: interval.start,
      durationMinutes: String(interval.durationMinutes),
    }));

    return accumulator;
  }, {} as PeriodIntervalsState);
}

function generateIntervalId(period: PeriodId): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${period}-${crypto.randomUUID()}`;
  }

  return `${period}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeHexColor(value: string): string {
  const trimmed = value.trim().toUpperCase();

  if (trimmed.startsWith("#")) {
    return trimmed;
  }

  return `#${trimmed}`;
}
