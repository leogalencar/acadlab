"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import Image from "next/image";
import { useFormStatus } from "react-dom";
import {
  CalendarX2,
  Image as ImageIcon,
  Plus,
  RefreshCw,
  Trash2,
  Undo2,
  UploadCloud,
} from "lucide-react";

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
  DEFAULT_SYSTEM_RULES,
  PERIOD_IDS,
  SUPPORTED_TIME_ZONES,
  type PeriodId,
} from "@/features/system-rules/constants";
import { updateSystemRulesAction } from "@/features/system-rules/server/actions";
import type {
  NonTeachingDayRuleMinutes,
  SerializableSystemRules,
} from "@/features/system-rules/types";
import { buildPaletteCssVariables, formatMinutesToTime } from "@/features/system-rules/utils";

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

const WEEKDAY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "0", label: "Domingo" },
  { value: "1", label: "Segunda-feira" },
  { value: "2", label: "Terça-feira" },
  { value: "3", label: "Quarta-feira" },
  { value: "4", label: "Quinta-feira" },
  { value: "5", label: "Sexta-feira" },
  { value: "6", label: "Sábado" },
];

interface SystemRulesFormProps {
  rules: SerializableSystemRules;
}

interface ColorState {
  primary: string;
  secondary: string;
  accent: string;
  success: string;
  warning: string;
  info: string;
  danger: string;
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

interface NonTeachingDayFormState {
  id: string;
  kind: "specific-date" | "weekday";
  date: string;
  weekDay: string;
  description: string;
  repeatsAnnually: boolean;
}

interface BrandingState {
  institutionName: string;
  logoUrl: string | null;
}

interface AcademicPeriodFormState {
  label: string;
  durationWeeks: string;
  description: string;
}

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
  const [timeZone, setTimeZone] = useState<string>(() => rules.timeZone);
  const [nonTeachingDays, setNonTeachingDays] = useState<NonTeachingDayFormState[]>(() =>
    createNonTeachingDaysState(rules),
  );
  const [branding, setBranding] = useState<BrandingState>(() => createBrandingState(rules));
  const [logoPreview, setLogoPreview] = useState<string | null>(rules.branding.logoUrl ?? null);
  const [logoAction, setLogoAction] = useState<"keep" | "remove" | "replace">("keep");
  const [academicPeriod, setAcademicPeriod] = useState<AcademicPeriodFormState>(() =>
    createAcademicPeriodFormState(rules),
  );

  const paletteBaseRef = useRef<Record<string, string> | null>(null);
  const logoObjectUrlRef = useRef<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setColors(createColorState(rules));
    setIntervalsByPeriod(createIntervalsState(rules));
    setPeriodFields(createPeriodFieldsState(rules));
    setEmailDomains(createEmailDomainState(rules));
    setTimeZone(rules.timeZone);
    setNonTeachingDays(createNonTeachingDaysState(rules));
    setBranding(createBrandingState(rules));
    setLogoPreview(rules.branding.logoUrl ?? null);
    setLogoAction("keep");
    setAcademicPeriod(createAcademicPeriodFormState(rules));
    if (logoInputRef.current) {
      logoInputRef.current.value = "";
    }
    if (logoObjectUrlRef.current) {
      URL.revokeObjectURL(logoObjectUrlRef.current);
      logoObjectUrlRef.current = null;
    }
  }, [rules]);

  useEffect(() => {
    if (paletteBaseRef.current) {
      return;
    }

    paletteBaseRef.current = buildPaletteCssVariables({
      primaryColor: rules.primaryColor,
      secondaryColor: rules.secondaryColor,
      accentColor: rules.accentColor,
      successColor: rules.successColor,
      warningColor: rules.warningColor,
      infoColor: rules.infoColor,
      dangerColor: rules.dangerColor,
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
      successColor: colors.success,
      warningColor: colors.warning,
      infoColor: colors.info,
      dangerColor: colors.danger,
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

      if (logoObjectUrlRef.current) {
        URL.revokeObjectURL(logoObjectUrlRef.current);
        logoObjectUrlRef.current = null;
      }
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
      successColor: colors.success,
      warningColor: colors.warning,
      infoColor: colors.info,
      dangerColor: colors.danger,
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

  const handleAddNonTeachingDay = (kind: "specific-date" | "weekday", presetWeekDay?: string) => {
    setNonTeachingDays((previous) => [
      ...previous,
      createEmptyNonTeachingDay(kind, presetWeekDay),
    ]);
  };

  const handleAutoAddSunday = () => {
    setNonTeachingDays((previous) => {
      if (previous.some((entry) => entry.kind === "weekday" && entry.weekDay === "0")) {
        return previous;
      }
      return [...previous, createEmptyNonTeachingDay("weekday", "0")];
    });
  };

  const handleNonTeachingDayChange = (
    id: string,
    field: keyof NonTeachingDayFormState,
    value: string | boolean,
  ) => {
    setNonTeachingDays((previous) =>
      previous.map((entry) => {
        if (entry.id !== id) {
          return entry;
        }

        if (field === "kind") {
          const nextKind = value as NonTeachingDayFormState["kind"];
          return {
            ...entry,
            kind: nextKind,
            date: nextKind === "specific-date" ? entry.date : "",
            weekDay: nextKind === "weekday" ? (entry.weekDay || "0") : "",
            repeatsAnnually: nextKind === "specific-date" ? entry.repeatsAnnually : false,
          };
        }

        if (field === "repeatsAnnually") {
          return { ...entry, repeatsAnnually: Boolean(value) };
        }

        return {
          ...entry,
          [field]: typeof value === "string" ? value : entry[field],
        } as NonTeachingDayFormState;
      }),
    );
  };

  const handleRemoveNonTeachingDay = (id: string) => {
    setNonTeachingDays((previous) => previous.filter((entry) => entry.id !== id));
  };

  const handleRestoreAcademicPeriod = () => {
    setAcademicPeriod({
      label: DEFAULT_SYSTEM_RULES.schedule.academicPeriod.label,
      durationWeeks: String(DEFAULT_SYSTEM_RULES.schedule.academicPeriod.durationWeeks),
      description: DEFAULT_SYSTEM_RULES.schedule.academicPeriod.description ?? "",
    });
  };

  const handleRestoreNonTeachingDays = () => {
    setNonTeachingDays(createDefaultNonTeachingDaysState());
  };

  const handleInstitutionNameChange = (value: string) => {
    setBranding((previous) => ({ ...previous, institutionName: value }));
  };

  const handleLogoSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];

    if (!file) {
      return;
    }

    if (logoObjectUrlRef.current) {
      URL.revokeObjectURL(logoObjectUrlRef.current);
      logoObjectUrlRef.current = null;
    }

    const url = URL.createObjectURL(file);
    logoObjectUrlRef.current = url;
    setLogoPreview(url);
    setLogoAction("replace");
  };

  const handleRemoveLogo = () => {
    if (logoObjectUrlRef.current) {
      URL.revokeObjectURL(logoObjectUrlRef.current);
      logoObjectUrlRef.current = null;
    }

    if (logoInputRef.current) {
      logoInputRef.current.value = "";
    }

    setLogoPreview(null);
    setLogoAction(branding.logoUrl ? "remove" : "keep");
  };

  const handleRestoreLogo = () => {
    if (logoObjectUrlRef.current) {
      URL.revokeObjectURL(logoObjectUrlRef.current);
      logoObjectUrlRef.current = null;
    }

    if (logoInputRef.current) {
      logoInputRef.current.value = "";
    }

    setLogoPreview(branding.logoUrl);
    setLogoAction("keep");
  };

  const handleRestoreAll = () => {
    setColors(createDefaultColorState());
    setPeriodFields(createDefaultPeriodFieldsState());
    setIntervalsByPeriod(createDefaultIntervalsState());
    setEmailDomains(createDefaultEmailDomainState());
    setTimeZone(DEFAULT_SYSTEM_RULES.schedule.timeZone);
    const defaultNonTeaching = createDefaultNonTeachingDaysState();
    setNonTeachingDays(defaultNonTeaching);
    const defaultBranding = createDefaultBrandingState();
    setBranding(defaultBranding);
    setLogoPreview(defaultBranding.logoUrl);
    setLogoAction("keep");
    setAcademicPeriod({
      label: DEFAULT_SYSTEM_RULES.schedule.academicPeriod.label,
      durationWeeks: String(DEFAULT_SYSTEM_RULES.schedule.academicPeriod.durationWeeks),
      description: DEFAULT_SYSTEM_RULES.schedule.academicPeriod.description ?? "",
    });
    if (logoInputRef.current) {
      logoInputRef.current.value = "";
    }
  };

  return (
    <form className="space-y-8" action={formAction}>
      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl">Identidade visual do sistema</CardTitle>
            <CardDescription>
              Personalize o nome da instituição e o logotipo exibido na navegação interna.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handleRestoreLogo}>
              <Undo2 className="mr-2 size-4" />
              Restaurar logotipo
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handleRestoreColors}>
              <RefreshCw className="mr-2 size-4" />
              Restaurar paleta
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="institutionName">Nome da instituição</Label>
              <Input
                id="institutionName"
                name="institutionName"
                value={branding.institutionName}
                onChange={(event) => handleInstitutionNameChange(event.currentTarget.value)}
                placeholder="ex.: Fatec Dom Amaury Castanho"
              />
              <HelperText>
                Esse nome aparece no cabeçalho e em documentos exportados.
              </HelperText>
            </div>
            <div className="space-y-2">
              <Label>Logotipo</Label>
              <div className="flex items-start gap-4">
                <div className="flex h-24 w-24 items-center justify-center rounded-md border border-dashed border-border/60 bg-muted/50">
                  {logoPreview ? (
                    <Image
                      src={logoPreview}
                      alt="Pré-visualização do logotipo"
                      width={96}
                      height={96}
                      className="max-h-20 max-w-20 object-contain"
                    />
                  ) : (
                    <ImageIcon className="size-8 text-muted-foreground" aria-hidden />
                  )}
                </div>
                <div className="flex-1 space-y-2 text-sm text-muted-foreground">
                  <Input
                    ref={logoInputRef}
                    id="logoFile"
                    name="logoFile"
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml"
                    onChange={handleLogoSelect}
                  />
                  <p>Formatos recomendados: PNG, JPG ou SVG até 256 KB.</p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="secondary" size="sm" onClick={handleRemoveLogo}>
                      <Trash2 className="mr-2 size-4" />
                      Remover logotipo
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={handleRestoreLogo}>
                      <UploadCloud className="mr-2 size-4" />
                      Reverter alteração
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="grid gap-4">
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
              description="Utilizada em barras laterais, cabeçalhos e planos de fundo."
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
            <div className="grid gap-4 sm:grid-cols-2">
              <ColorField
                id="successColor"
                name="successColor"
                label="Cor de sucesso"
                description="Indicadores positivos e confirmações."
                value={colors.success}
                onValueChange={handleColorChange("success")}
              />
              <ColorField
                id="warningColor"
                name="warningColor"
                label="Cor de aviso"
                description="Alertas e mensagens de atenção."
                value={colors.warning}
                onValueChange={handleColorChange("warning")}
              />
              <ColorField
                id="infoColor"
                name="infoColor"
                label="Cor informativa"
                description="Realça itens neutros ou informativos."
                value={colors.info}
                onValueChange={handleColorChange("info")}
              />
              <ColorField
                id="dangerColor"
                name="dangerColor"
                label="Cor crítica"
                description="Utilizada em mensagens de erro e itens bloqueados."
                value={colors.danger}
                onValueChange={handleColorChange("danger")}
              />
            </div>
          </div>
        </CardContent>
      </Card>

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

      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl">Configurações gerais do calendário</CardTitle>
            <CardDescription>
              Defina o fuso horário padrão, o período letivo da instituição e cadastre dias não letivos.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handleRestoreAcademicPeriod}>
              Restaurar período letivo
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handleRestoreNonTeachingDays}>
              Restaurar dias padrão
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="timeZone">Fuso horário</Label>
            <select
              id="timeZone"
              name="timeZone"
              value={timeZone}
              onChange={(event) => setTimeZone(event.currentTarget.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {SUPPORTED_TIME_ZONES.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
            <HelperText>
              Os horários exibidos no sistema seguirão este fuso horário.
            </HelperText>
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="space-y-2">
              <Label htmlFor="classPeriodLabel">Nome do período letivo</Label>
              <Input
                id="classPeriodLabel"
                name="classPeriodLabel"
                value={academicPeriod.label}
                onChange={(event) =>
                  setAcademicPeriod((previous) => ({
                    ...previous,
                    label: event.currentTarget.value,
                  }))
                }
                placeholder="Ex.: Semestre letivo"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="classPeriodDurationWeeks">Duração (semanas)</Label>
              <Input
                id="classPeriodDurationWeeks"
                name="classPeriodDurationWeeks"
                type="number"
                min={1}
                max={52}
                value={academicPeriod.durationWeeks}
                onChange={(event) =>
                  setAcademicPeriod((previous) => ({
                    ...previous,
                    durationWeeks: event.currentTarget.value,
                  }))
                }
                placeholder="Ex.: 20"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="classPeriodDescription">Descrição do período</Label>
            <textarea
              id="classPeriodDescription"
              name="classPeriodDescription"
              value={academicPeriod.description}
              onChange={(event) =>
                setAcademicPeriod((previous) => ({
                  ...previous,
                  description: event.currentTarget.value,
                }))
              }
              className="min-h-[72px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Informações adicionais sobre este período (opcional)."
            />
            <HelperText>
              Informe o período acadêmico padrão para automatizar agendamentos recorrentes.
            </HelperText>
          </div>

          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Dias não letivos</p>
                <p className="text-xs text-muted-foreground">
                  Cadastre datas específicas ou dias da semana em que não devem ocorrer reservas.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => handleAddNonTeachingDay("specific-date")}>
                  <CalendarX2 className="mr-2 size-4" />
                  Adicionar data
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => handleAddNonTeachingDay("weekday") }>
                  <Plus className="mr-2 size-4" />
                  Adicionar dia da semana
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={handleAutoAddSunday}>
                  Marcar domingos automaticamente
                </Button>
              </div>
            </div>

            {nonTeachingDays.length === 0 ? (
              <div className="rounded-md border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                Nenhum dia não letivo cadastrado. Utilize os botões acima para adicionar datas ou recorrências.
              </div>
            ) : (
              <div className="space-y-3">
                {nonTeachingDays.map((entry, index) => (
                  <div
                    key={entry.id}
                    className="space-y-3 rounded-lg border border-border/60 p-4"
                  >
                    <input type="hidden" name={`nonTeachingDays.${index}.id`} value={entry.id} />
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                      <div className="space-y-1">
                        <Label htmlFor={`nonTeachingDays.${index}.kind`}>Tipo</Label>
                        <select
                          id={`nonTeachingDays.${index}.kind`}
                          name={`nonTeachingDays.${index}.kind`}
                          value={entry.kind}
                          onChange={(event) =>
                            handleNonTeachingDayChange(entry.id, "kind", event.currentTarget.value)
                          }
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <option value="specific-date">Data específica</option>
                          <option value="weekday">Dia da semana</option>
                        </select>
                      </div>
                      {entry.kind === "specific-date" ? (
                        <div className="space-y-1">
                          <Label htmlFor={`nonTeachingDays.${index}.date`}>Data</Label>
                          <Input
                            id={`nonTeachingDays.${index}.date`}
                            name={`nonTeachingDays.${index}.date`}
                            type="date"
                            required
                            value={entry.date}
                            onChange={(event) =>
                              handleNonTeachingDayChange(entry.id, "date", event.currentTarget.value)
                            }
                          />
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <Label htmlFor={`nonTeachingDays.${index}.weekDay`}>Dia da semana</Label>
                          <select
                            id={`nonTeachingDays.${index}.weekDay`}
                            name={`nonTeachingDays.${index}.weekDay`}
                            value={entry.weekDay}
                            onChange={(event) =>
                              handleNonTeachingDayChange(entry.id, "weekDay", event.currentTarget.value)
                            }
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          >
                            {WEEKDAY_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div className="flex items-end justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemoveNonTeachingDay(entry.id)}
                          aria-label="Remover dia não letivo"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                    {entry.kind === "specific-date" ? (
                      <div className="flex items-center gap-2 text-sm">
                        <input
                          id={`nonTeachingDays.${index}.repeatsAnnually`}
                          name={`nonTeachingDays.${index}.repeatsAnnually`}
                          type="checkbox"
                          checked={entry.repeatsAnnually}
                          onChange={(event) =>
                            handleNonTeachingDayChange(entry.id, "repeatsAnnually", event.currentTarget.checked)
                          }
                          className="h-4 w-4"
                        />
                        <Label htmlFor={`nonTeachingDays.${index}.repeatsAnnually`} className="text-sm">
                          Repetir anualmente
                        </Label>
                      </div>
                    ) : (
                      <input
                        type="hidden"
                        name={`nonTeachingDays.${index}.repeatsAnnually`}
                        value="false"
                      />
                    )}
                    {entry.kind === "weekday" ? (
                      <input type="hidden" name={`nonTeachingDays.${index}.date`} value="" />
                    ) : (
                      <input type="hidden" name={`nonTeachingDays.${index}.weekDay`} value="" />
                    )}
                    <div className="space-y-1">
                      <Label htmlFor={`nonTeachingDays.${index}.description`}>Descrição</Label>
                      <Input
                        id={`nonTeachingDays.${index}.description`}
                        name={`nonTeachingDays.${index}.description`}
                        value={entry.description}
                        onChange={(event) =>
                          handleNonTeachingDayChange(entry.id, "description", event.currentTarget.value)
                        }
                        placeholder="ex.: Recesso acadêmico"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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

      <input type="hidden" name="logoAction" value={logoAction} />
      <div className="space-y-4 rounded-lg border border-border/60 bg-muted/40 p-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Resumo das alterações</p>
        <ul className="list-disc space-y-1 pl-4">
          <li>As cores selecionadas são aplicadas imediatamente para facilitar a visualização.</li>
          <li>
            Horários e dias não letivos são validados para evitar conflitos na geração da agenda.
          </li>
          {lastUpdatedLabel ? (
            <li>Última atualização confirmada em {lastUpdatedLabel}.</li>
          ) : null}
        </ul>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" variant="outline" onClick={handleRestoreAll}>
          Restaurar todas as regras
        </Button>
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

function createColorState(rules: SerializableSystemRules): ColorState {
  return {
    primary: rules.primaryColor.toUpperCase(),
    secondary: rules.secondaryColor.toUpperCase(),
    accent: rules.accentColor.toUpperCase(),
    success: rules.successColor.toUpperCase(),
    warning: rules.warningColor.toUpperCase(),
    info: rules.infoColor.toUpperCase(),
    danger: rules.dangerColor.toUpperCase(),
  };
}

function createDefaultColorState(): ColorState {
  return {
    primary: DEFAULT_COLOR_RULES.primaryColor.toUpperCase(),
    secondary: DEFAULT_COLOR_RULES.secondaryColor.toUpperCase(),
    accent: DEFAULT_COLOR_RULES.accentColor.toUpperCase(),
    success: DEFAULT_COLOR_RULES.successColor.toUpperCase(),
    warning: DEFAULT_COLOR_RULES.warningColor.toUpperCase(),
    info: DEFAULT_COLOR_RULES.infoColor.toUpperCase(),
    danger: DEFAULT_COLOR_RULES.dangerColor.toUpperCase(),
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
  if (rules.allowedEmailDomains.length === 0) {
    return [{ id: generateDomainId(), value: "" }];
  }

  return rules.allowedEmailDomains.map((domain) => ({
    id: generateDomainId(),
    value: domain,
  }));
}

function createDefaultEmailDomainState(): EmailDomainFormState[] {
  return DEFAULT_ALLOWED_EMAIL_DOMAINS.map((domain) => ({
    id: generateDomainId(),
    value: domain,
  }));
}

function createNonTeachingDaysState(rules: SerializableSystemRules): NonTeachingDayFormState[] {
  if (rules.nonTeachingDays.length === 0) {
    return createDefaultNonTeachingDaysState();
  }

  return rules.nonTeachingDays.map((entry) => ({
    id: entry.id || generateNonTeachingDayId(),
    kind: entry.kind,
    date: entry.kind === "specific-date" ? entry.date ?? "" : "",
    weekDay: entry.kind === "weekday" ? String(entry.weekDay ?? "0") : "",
    description: entry.description ?? "",
    repeatsAnnually: entry.kind === "specific-date" ? Boolean(entry.repeatsAnnually) : false,
  }));
}

function createDefaultNonTeachingDaysState(): NonTeachingDayFormState[] {
  const defaults =
    DEFAULT_SYSTEM_RULES.schedule.nonTeachingDays as Readonly<NonTeachingDayRuleMinutes[]>;

  return defaults.map((entry) => ({
    id: entry.id ?? generateNonTeachingDayId(),
    kind: entry.kind,
    date: entry.kind === "specific-date" ? entry.date ?? "" : "",
    weekDay: entry.kind === "weekday" ? String(entry.weekDay ?? "0") : "",
    description: entry.description ?? "",
    repeatsAnnually: entry.kind === "specific-date" ? Boolean(entry.repeatsAnnually) : false,
  }));
}

function createEmptyNonTeachingDay(
  kind: "specific-date" | "weekday",
  presetWeekDay?: string,
): NonTeachingDayFormState {
  return {
    id: generateNonTeachingDayId(),
    kind,
    date: kind === "specific-date" ? "" : "",
    weekDay: kind === "weekday" ? presetWeekDay ?? "0" : "",
    description: "",
    repeatsAnnually: kind === "specific-date" ? false : false,
  };
}

function createBrandingState(rules: SerializableSystemRules): BrandingState {
  return {
    institutionName: rules.branding.institutionName,
    logoUrl: rules.branding.logoUrl,
  };
}

function createAcademicPeriodFormState(rules: SerializableSystemRules): AcademicPeriodFormState {
  return {
    label: rules.academicPeriod.label,
    durationWeeks: String(rules.academicPeriod.durationWeeks),
    description: rules.academicPeriod.description ?? "",
  };
}

function createDefaultBrandingState(): BrandingState {
  return {
    institutionName: DEFAULT_SYSTEM_RULES.branding.institutionName,
    logoUrl: DEFAULT_SYSTEM_RULES.branding.logoUrl,
  };
}

function generateIntervalId(period: PeriodId) {
  return `${period}-interval-${Math.random().toString(36).slice(2, 10)}`;
}

function generateDomainId() {
  return `domain-${Math.random().toString(36).slice(2, 10)}`;
}

function generateNonTeachingDayId() {
  return `non-teaching-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeHexColor(value: string): string {
  const sanitized = value.trim().toUpperCase();
  if (/^#[0-9A-F]{6}$/.test(sanitized)) {
    return sanitized;
  }
  if (/^[0-9A-F]{6}$/.test(sanitized)) {
    return `#${sanitized}`;
  }
  return "#000000";
}
