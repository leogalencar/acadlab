"use client";

import type { ReactNode } from "react";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
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
import {
  DEFAULT_ALLOWED_EMAIL_DOMAINS,
  DEFAULT_COLOR_RULES,
  DEFAULT_PERIOD_RULES_MINUTES,
  DEFAULT_TIME_ZONE,
  PERIOD_IDS,
  type PeriodId,
} from "@/features/system-rules/constants";
import { updateSystemRulesAction } from "@/features/system-rules/server/actions";
import type { SerializableSystemRules } from "@/features/system-rules/types";
import {
  buildPaletteCssVariables,
  formatMinutesToTime,
} from "@/features/system-rules/utils";

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

interface PeriodFieldState {
  firstClassTime: string;
  classDurationMinutes: string;
  classesCount: string;
}

type PeriodFieldsState = Record<PeriodId, PeriodFieldState>;

type PeriodFieldKey = keyof PeriodFieldState;

interface EmailDomainFormState {
  id: string;
  value: string;
}

interface AcademicPeriodFormState {
  id: string;
  name: string;
  type: string;
  startDate: string;
  endDate: string;
}

const SUPPORTED_TIME_ZONES = typeof Intl.supportedValuesOf === "function"
  ? Intl.supportedValuesOf("timeZone")
  : ["UTC"];

const ACADEMIC_PERIOD_TYPES = [
  { value: "BIMESTER", label: "Bimestre" },
  { value: "TRIMESTER", label: "Trimestre" },
  { value: "SEMESTER", label: "Semestre" },
  { value: "ANNUAL", label: "Anual" },
  { value: "CUSTOM", label: "Personalizado" },
] as const;

export function SystemRulesForm({ rules }: SystemRulesFormProps) {
  const [state, formAction] = useActionState(updateSystemRulesAction, FORM_INITIAL_STATE);

  const [colors, setColors] = useState<ColorState>(() => createColorState(rules));
  const [intervalsByPeriod, setIntervalsByPeriod] = useState<PeriodIntervalsState>(() =>
    createIntervalsState(rules),
  );
  const [periodFields, setPeriodFields] = useState<PeriodFieldsState>(() =>
    createPeriodFieldsState(rules),
  );
  const [emailDomains, setEmailDomains] = useState<EmailDomainFormState[]>(() =>
    createEmailDomainState(rules),
  );
  const [timeZone, setTimeZone] = useState<string>(() => rules.timeZone ?? DEFAULT_TIME_ZONE);
  const [academicPeriods, setAcademicPeriods] = useState<AcademicPeriodFormState[]>(() =>
    createAcademicPeriodsState(rules),
  );
  const academicPeriodsJson = useMemo(
    () =>
      JSON.stringify(
        academicPeriods.map((period) => ({
          id: period.id,
          name: period.name.trim(),
          type: period.type,
          startDate: period.startDate,
          endDate: period.endDate,
        })),
      ),
    [academicPeriods],
  );

  const paletteBaseRef = useRef<Record<string, string> | null>(null);

  useEffect(() => {
    setColors(createColorState(rules));
    setIntervalsByPeriod(createIntervalsState(rules));
    setPeriodFields(createPeriodFieldsState(rules));
    setEmailDomains(createEmailDomainState(rules));
    setTimeZone(rules.timeZone ?? DEFAULT_TIME_ZONE);
    setAcademicPeriods(createAcademicPeriodsState(rules));
  }, [rules]);

  useEffect(() => {
    if (paletteBaseRef.current) {
      return;
    }

    paletteBaseRef.current = buildPaletteCssVariables({
      primaryColor: rules.primaryColor,
      secondaryColor: rules.secondaryColor,
      accentColor: rules.accentColor,
    });
  }, [rules]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const style = document.body?.style;

    if (!style) {
      return;
    }

    const palette = buildPaletteCssVariables({
      primaryColor: colors.primary,
      secondaryColor: colors.secondary,
      accentColor: colors.accent,
    });

    Object.entries(palette).forEach(([property, value]) => {
      style.setProperty(property, value);
    });
  }, [colors]);

  useEffect(() => {
    return () => {
      if (typeof document === "undefined") {
        return;
      }

      const style = document.body?.style;

      if (!style || !paletteBaseRef.current) {
        return;
      }

      Object.entries(paletteBaseRef.current).forEach(([property, value]) => {
        style.setProperty(property, value);
      });
    };
  }, []);

  useEffect(() => {
    if (state.status !== "success") {
      return;
    }

    paletteBaseRef.current = buildPaletteCssVariables({
      primaryColor: colors.primary,
      secondaryColor: colors.secondary,
      accentColor: colors.accent,
    });
  }, [state.status, colors]);

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

  const handlePeriodFieldChange = (
    period: PeriodId,
    field: PeriodFieldKey,
    value: string,
  ) => {
    setPeriodFields((previous) => ({
      ...previous,
      [period]: {
        ...previous[period],
        [field]: value,
      },
    }));
  };

  const handleEmailDomainChange = (domainId: string, value: string) => {
    const normalized = value.toLowerCase();
    setEmailDomains((previous) =>
      previous.map((domain) =>
        domain.id === domainId ? { ...domain, value: normalized } : domain,
      ),
    );
  };

  const handleTimeZoneChange = (nextValue: string) => {
    setTimeZone(nextValue);
  };

  const handleRestoreTimeZone = () => {
    setTimeZone(DEFAULT_TIME_ZONE);
  };

  const handleAcademicPeriodChange = (
    periodId: string,
    field: keyof Omit<AcademicPeriodFormState, "id">,
    value: string,
  ) => {
    setAcademicPeriods((previous) =>
      previous.map((period) =>
        period.id === periodId ? { ...period, [field]: value } : period,
      ),
    );
  };

  const handleAddAcademicPeriod = () => {
    setAcademicPeriods((previous) => [
      ...previous,
      {
        id: generateAcademicPeriodId(),
        name: "",
        type: "SEMESTER",
        startDate: "",
        endDate: "",
      },
    ]);
  };

  const handleRemoveAcademicPeriod = (periodId: string) => {
    setAcademicPeriods((previous) => previous.filter((period) => period.id !== periodId));
  };

  const handleRestoreAcademicPeriods = () => {
    setAcademicPeriods(createDefaultAcademicPeriodsState());
  };

  const handleEmailDomainBlur = () => {
    setEmailDomains((previous) => {
      const sanitized = previous.map((domain) => ({
        ...domain,
        value: domain.value.trim().toLowerCase(),
      }));

      const seen = new Set<string>();
      const nextState: EmailDomainFormState[] = [];

      for (const domain of sanitized) {
        if (!domain.value) {
          nextState.push(domain);
          continue;
        }

        if (seen.has(domain.value)) {
          continue;
        }

        seen.add(domain.value);
        nextState.push(domain);
      }

      return nextState.length > 0 ? nextState : [{ id: generateDomainId(), value: "" }];
    });
  };

  const handleAddEmailDomain = () => {
    setEmailDomains((previous) => [
      ...previous,
      { id: generateDomainId(), value: "" },
    ]);
  };

  const handleRemoveEmailDomain = (domainId: string) => {
    setEmailDomains((previous) => {
      const remaining = previous.filter((domain) => domain.id !== domainId);
      if (remaining.length === 0) {
        return [{ id: generateDomainId(), value: "" }];
      }
      return remaining;
    });
  };

  const handleRestoreEmailDomains = () => {
    setEmailDomains(createDefaultEmailDomainState());
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

      const firstClassTime = periodFields[period]?.firstClassTime ??
        rules.periods[period].firstClassTime;

      const nextInterval: IntervalFormState = {
        id: generateIntervalId(period),
        start: lastInterval?.start ?? firstClassTime,
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

  const handleRestoreColors = () => {
    setColors(createDefaultColorState());
  };

  const handleRestorePeriod = (period: PeriodId) => {
    setPeriodFields((previous) => ({
      ...previous,
      [period]: createDefaultPeriodFieldState(period),
    }));

    setIntervalsByPeriod((previous) => ({
      ...previous,
      [period]: createDefaultIntervalsForPeriod(period),
    }));
  };

  const handleRestoreAll = () => {
    setColors(createDefaultColorState());
    setPeriodFields(createDefaultPeriodFieldsState());
    setIntervalsByPeriod(createDefaultIntervalsState());
    setEmailDomains(createDefaultEmailDomainState());
    setTimeZone(DEFAULT_TIME_ZONE);
    setAcademicPeriods(createDefaultAcademicPeriodsState());
  };

  return (
    <form className="space-y-8" action={formAction}>
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl">Identidade visual do sistema</CardTitle>
            <CardDescription>
              Defina as cores que serão utilizadas em botões, links e destaques da interface.
            </CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handleRestoreColors}>
            Restaurar padrão de cores
          </Button>
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

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl">Fuso horário institucional</CardTitle>
            <CardDescription>
              Defina o fuso utilizado para gerar os horários de aulas e reservas em toda a plataforma.
            </CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handleRestoreTimeZone}>
            Restaurar fuso padrão
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="timeZone">Fuso horário</Label>
            <Input
              id="timeZone"
              name="timeZone"
              value={timeZone}
              onChange={(event) => handleTimeZoneChange(event.currentTarget.value)}
              list="timezone-options"
              autoComplete="off"
            />
            <HelperText>
              Utilize identificadores IANA, como <code>America/Sao_Paulo</code> ou <code>Europe/Lisbon</code>.
            </HelperText>
          </div>
        </CardContent>
      </Card>

      <datalist id="timezone-options">
        {SUPPORTED_TIME_ZONES.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl">Períodos letivos</CardTitle>
            <CardDescription>
              Controle os intervalos acadêmicos (bimestres, semestres, etc.) utilizados para programar alocações extensas de laboratórios.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRestoreAcademicPeriods}
          >
            Limpar períodos
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <HelperText>
            Cadastre os intervalos em que disciplinas utilizam laboratórios de forma recorrente. Essas informações ficam disponíveis ao alocar reservas por todo o período.
          </HelperText>

          {academicPeriods.length === 0 ? (
            <div className="rounded-md border border-dashed border-border/60 bg-muted/40 p-4 text-sm text-muted-foreground">
              Nenhum período letivo configurado. Adicione um período para iniciar.
            </div>
          ) : null}

          <div className="space-y-4">
            {academicPeriods.map((period, index) => (
              <div
                key={period.id}
                className="space-y-4 rounded-lg border border-border/60 bg-background p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">
                    Período {index + 1}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveAcademicPeriod(period.id)}
                    aria-label={`Remover período ${index + 1}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`academic-period-${period.id}-name`}>Nome do período</Label>
                    <Input
                      id={`academic-period-${period.id}-name`}
                      value={period.name}
                      onChange={(event) =>
                        handleAcademicPeriodChange(period.id, "name", event.currentTarget.value)
                      }
                      placeholder="Ex.: 1º Semestre 2025"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`academic-period-${period.id}-type`}>Tipo</Label>
                    <select
                      id={`academic-period-${period.id}-type`}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      value={period.type}
                      onChange={(event) =>
                        handleAcademicPeriodChange(period.id, "type", event.currentTarget.value)
                      }
                    >
                      {ACADEMIC_PERIOD_TYPES.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`academic-period-${period.id}-start`}>Data inicial</Label>
                    <Input
                      id={`academic-period-${period.id}-start`}
                      type="date"
                      value={period.startDate}
                      onChange={(event) =>
                        handleAcademicPeriodChange(period.id, "startDate", event.currentTarget.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`academic-period-${period.id}-end`}>Data final</Label>
                    <Input
                      id={`academic-period-${period.id}-end`}
                      type="date"
                      value={period.endDate}
                      onChange={(event) =>
                        handleAcademicPeriodChange(period.id, "endDate", event.currentTarget.value)
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Button type="button" variant="outline" size="sm" onClick={handleAddAcademicPeriod}>
            <Plus className="mr-2 size-4" />
            Adicionar período letivo
          </Button>
        </CardContent>
      </Card>

      <input type="hidden" name="academicPeriods" value={academicPeriodsJson} />

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl">Domínios de e-mail permitidos</CardTitle>
            <CardDescription>
              Restrinja o cadastro de usuários aos domínios institucionais autorizados.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRestoreEmailDomains}
          >
            Restaurar domínios padrão
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <HelperText>
            Somente endereços que terminarem com os domínios abaixo poderão ser cadastrados.
          </HelperText>
          <div className="space-y-4">
            {emailDomains.map((domain, index) => (
              <div key={domain.id} className="space-y-2">
                <Label htmlFor={`allowedEmailDomains-${domain.id}`}>
                  Domínio permitido {index + 1}
                </Label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    id={`allowedEmailDomains-${domain.id}`}
                    name="allowedEmailDomains"
                    value={domain.value}
                    onChange={(event) =>
                      handleEmailDomainChange(domain.id, event.currentTarget.value)
                    }
                    onBlur={handleEmailDomainBlur}
                    placeholder="ex.: fatec.sp.gov.br"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveEmailDomain(domain.id)}
                    aria-label={`Remover domínio ${index + 1}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handleAddEmailDomain}>
            <Plus className="mr-2 size-4" />
            Adicionar domínio
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-6">
        {PERIOD_IDS.map((period) => {
          const metadata = PERIOD_METADATA[period];
          const periodRules = periodFields[period];
          const intervalState = intervalsByPeriod[period] ?? [];

          return (
            <Card key={period}>
              <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-xl">{metadata.title}</CardTitle>
                  <CardDescription>{metadata.description}</CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleRestorePeriod(period)}
                >
                  Restaurar período padrão
                </Button>
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
                      value={periodRules.firstClassTime}
                      onChange={(event) =>
                        handlePeriodFieldChange(period, "firstClassTime", event.currentTarget.value)
                      }
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
                      value={periodRules.classDurationMinutes}
                      onChange={(event) =>
                        handlePeriodFieldChange(
                          period,
                          "classDurationMinutes",
                          event.currentTarget.value,
                        )
                      }
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
                      value={periodRules.classesCount}
                      onChange={(event) =>
                        handlePeriodFieldChange(period, "classesCount", event.currentTarget.value)
                      }
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

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-muted-foreground">
          {lastUpdatedLabel ? (
            <p>Última atualização registrada em {lastUpdatedLabel}.</p>
          ) : (
            <p>Os ajustes são aplicados imediatamente após a confirmação.</p>
          )}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button type="button" variant="outline" onClick={handleRestoreAll}>
            Restaurar todas as regras
          </Button>
          <SaveButton />
        </div>
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
          onChange={(event) => {
            const nextValue = event.currentTarget.value.toUpperCase();
            setTextValue(nextValue);

            if (/^#[0-9A-F]{6}$/.test(nextValue)) {
              onValueChange(nextValue);
            }
          }}
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

function createAcademicPeriodsState(rules: SerializableSystemRules): AcademicPeriodFormState[] {
  if (!rules.academicPeriods || rules.academicPeriods.length === 0) {
    return [];
  }

  return rules.academicPeriods.map((period) => ({
    id: period.id ?? generateAcademicPeriodId(),
    name: period.name,
    type: period.type,
    startDate: period.startDate,
    endDate: period.endDate,
  }));
}

function createDefaultAcademicPeriodsState(): AcademicPeriodFormState[] {
  return [];
}

function generateAcademicPeriodId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `period-${crypto.randomUUID()}`;
  }

  return `period-${Math.random().toString(36).slice(2, 10)}`;
}

function createColorState(rules: SerializableSystemRules): ColorState {
  return {
    primary: rules.primaryColor.toUpperCase(),
    secondary: rules.secondaryColor.toUpperCase(),
    accent: rules.accentColor.toUpperCase(),
  };
}

function createDefaultColorState(): ColorState {
  return {
    primary: DEFAULT_COLOR_RULES.primaryColor.toUpperCase(),
    secondary: DEFAULT_COLOR_RULES.secondaryColor.toUpperCase(),
    accent: DEFAULT_COLOR_RULES.accentColor.toUpperCase(),
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

function createDefaultIntervalsState(): PeriodIntervalsState {
  return PERIOD_IDS.reduce((accumulator, period) => {
    accumulator[period] = createDefaultIntervalsForPeriod(period);

    return accumulator;
  }, {} as PeriodIntervalsState);
}

function createDefaultIntervalsForPeriod(period: PeriodId): IntervalFormState[] {
  const defaults = DEFAULT_PERIOD_RULES_MINUTES[period];

  return defaults.intervals.map((interval) => ({
    id: generateIntervalId(period),
    start: formatMinutesToTime(interval.start),
    durationMinutes: String(interval.durationMinutes),
  }));
}

function createPeriodFieldsState(rules: SerializableSystemRules): PeriodFieldsState {
  return PERIOD_IDS.reduce((accumulator, period) => {
    const periodRules = rules.periods[period];

    accumulator[period] = {
      firstClassTime: periodRules.firstClassTime,
      classDurationMinutes: String(periodRules.classDurationMinutes),
      classesCount: String(periodRules.classesCount),
    };

    return accumulator;
  }, {} as PeriodFieldsState);
}

function createDefaultPeriodFieldsState(): PeriodFieldsState {
  return PERIOD_IDS.reduce((accumulator, period) => {
    accumulator[period] = createDefaultPeriodFieldState(period);
    return accumulator;
  }, {} as PeriodFieldsState);
}

function createDefaultPeriodFieldState(period: PeriodId): PeriodFieldState {
  const defaults = DEFAULT_PERIOD_RULES_MINUTES[period];

  return {
    firstClassTime: formatMinutesToTime(defaults.firstClassTime),
    classDurationMinutes: String(defaults.classDurationMinutes),
    classesCount: String(defaults.classesCount),
  };
}

function createEmailDomainState(rules: SerializableSystemRules): EmailDomainFormState[] {
  return mapDomainsToState(rules.allowedEmailDomains);
}

function createDefaultEmailDomainState(): EmailDomainFormState[] {
  return mapDomainsToState([...DEFAULT_ALLOWED_EMAIL_DOMAINS]);
}

function mapDomainsToState(domains: ReadonlyArray<string>): EmailDomainFormState[] {
  const source = domains.length > 0 ? domains : [""];

  return source.map((domain) => ({
    id: generateDomainId(),
    value: domain,
  }));
}

function generateIntervalId(period: PeriodId): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${period}-${crypto.randomUUID()}`;
  }

  return `${period}-${Math.random().toString(36).slice(2, 10)}`;
}

function generateDomainId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `domain-${crypto.randomUUID()}`;
  }

  return `domain-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeHexColor(value: string): string {
  // Remove all leading #, uppercase, and ensure a single leading #
  const hex = value.trim().replace(/^#+/, "").toUpperCase();
  // Only allow 3 or 6 hex digits (shorthand or full), fallback to empty if invalid
  const validHex = /^[0-9A-F]{3}$/.test(hex)
    ? hex
    : /^[0-9A-F]{6}$/.test(hex)
    ? hex
    : hex.slice(0, 6); // fallback: truncate to 6 chars
  return `#${validHex}`;
}
