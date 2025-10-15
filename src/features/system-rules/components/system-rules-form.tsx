"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";

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
  PERIOD_IDS,
  type PeriodId,
} from "@/features/system-rules/constants";
import { updateSystemRulesAction } from "@/features/system-rules/server/actions";
import type {
  SerializableSystemRules,
  SystemRulesActionState,
} from "@/features/system-rules/types";

const FORM_INITIAL_STATE: SystemRulesActionState = { status: "idle" };

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

export function SystemRulesForm({ rules }: SystemRulesFormProps) {
  const [state, formAction] = useFormState(
    updateSystemRulesAction,
    FORM_INITIAL_STATE,
  );

  const [colorPreview, setColorPreview] = useState({
    primary: rules.primaryColor,
    secondary: rules.secondaryColor,
    accent: rules.accentColor,
  });

  useEffect(() => {
    setColorPreview({
      primary: rules.primaryColor,
      secondary: rules.secondaryColor,
      accent: rules.accentColor,
    });
  }, [rules.primaryColor, rules.secondaryColor, rules.accentColor]);

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
            defaultValue={rules.primaryColor}
            previewColor={colorPreview.primary}
            onPreviewChange={(value) =>
              setColorPreview((prev) => ({ ...prev, primary: value }))
            }
          />
          <ColorField
            id="secondaryColor"
            name="secondaryColor"
            label="Cor secundária"
            description="Utilizada em barras, cabeçalhos e elementos complementares."
            defaultValue={rules.secondaryColor}
            previewColor={colorPreview.secondary}
            onPreviewChange={(value) =>
              setColorPreview((prev) => ({ ...prev, secondary: value }))
            }
          />
          <ColorField
            id="accentColor"
            name="accentColor"
            label="Cor de destaque"
            description="Aparece em links, indicadores e mensagens informativas."
            defaultValue={rules.accentColor}
            previewColor={colorPreview.accent}
            onPreviewChange={(value) =>
              setColorPreview((prev) => ({ ...prev, accent: value }))
            }
          />
        </CardContent>
      </Card>

      <div className="space-y-6">
        {PERIOD_IDS.map((period) => {
          const metadata = PERIOD_METADATA[period];
          const periodRules = rules.periods[period];

          return (
            <Card key={period}>
              <CardHeader>
                <CardTitle className="text-xl">{metadata.title}</CardTitle>
                <CardDescription>{metadata.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
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
                  <div className="space-y-2">
                    <Label htmlFor={`${period}.intervalStart`}>
                      Horário do intervalo
                    </Label>
                    <Input
                      id={`${period}.intervalStart`}
                      name={`${period}.intervalStart`}
                      type="time"
                      step={300}
                      required
                      defaultValue={periodRules.intervalStart}
                    />
                    <HelperText>
                      Informe o horário de início do intervalo principal.
                    </HelperText>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor={`${period}.intervalDurationMinutes`}>
                      Duração do intervalo (minutos)
                    </Label>
                    <Input
                      id={`${period}.intervalDurationMinutes`}
                      name={`${period}.intervalDurationMinutes`}
                      type="number"
                      min={0}
                      max={180}
                      required
                      defaultValue={periodRules.intervalDurationMinutes}
                    />
                    <HelperText>
                      Utilize 0 se não houver intervalo programado ou informe a duração desejada.
                    </HelperText>
                  </div>
                </div>
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
  defaultValue: string;
  previewColor: string;
  onPreviewChange: (value: string) => void;
}

function ColorField({
  id,
  name,
  label,
  description,
  defaultValue,
  previewColor,
  onPreviewChange,
}: ColorFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-3">
        <Input
          id={id}
          name={name}
          type="text"
          inputMode="text"
          pattern="^#[0-9A-Fa-f]{6}$"
          required
          maxLength={7}
          defaultValue={defaultValue}
          onChange={(event) => onPreviewChange(event.currentTarget.value.toUpperCase())}
          aria-describedby={`${id}-description`}
        />
        <span
          aria-hidden
          title={previewColor}
          className="flex size-10 items-center justify-center rounded-md border border-border/60 bg-muted text-[0.65rem] uppercase text-muted-foreground"
          style={{ backgroundColor: previewColor }}
        />
      </div>
      <HelperText id={`${id}-description`}>{description}</HelperText>
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
