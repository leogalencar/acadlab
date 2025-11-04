"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarSearch, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SchedulingLaboratorySearchResult } from "@/features/scheduling/types";
import { MultiCombobox, type MultiComboboxOption } from "@/features/shared/components/multi-combobox";
import type { SerializableSoftware } from "@/features/software-management/types";
import { cn } from "@/lib/utils";

interface SchedulingSearchProps {
  date: string;
  time?: string;
  timeZone: string;
  selectedSoftwareIds: string[];
  softwareOptions: SerializableSoftware[];
  results: SchedulingLaboratorySearchResult[];
  selectedLaboratoryId?: string;
  isLoading?: boolean;
  minimumCapacity?: number;
}

export function SchedulingSearch({
  date,
  time,
  timeZone,
  selectedSoftwareIds,
  softwareOptions,
  results,
  selectedLaboratoryId,
  isLoading = false,
  minimumCapacity,
}: SchedulingSearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedDate, setSelectedDate] = useState(date);
  const [selectedTime, setSelectedTime] = useState(time ?? "");
  const [softwareSelection, setSoftwareSelection] = useState<string[]>(selectedSoftwareIds);
  const [capacityFilter, setCapacityFilter] = useState(() =>
    typeof minimumCapacity === "number" ? String(minimumCapacity) : "",
  );

  useEffect(() => {
    setCapacityFilter(typeof minimumCapacity === "number" ? String(minimumCapacity) : "");
  }, [minimumCapacity]);

  const comboboxOptions = useMemo<MultiComboboxOption[]>(() => {
    return softwareOptions.map((software) => ({
      value: software.id,
      label: `${software.name} • ${software.version}`,
      description: software.supplier ? `Fornecedor: ${software.supplier}` : undefined,
    }));
  }, [softwareOptions]);

  const timeFormatter = useMemo(() => {
    return new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone,
    });
  }, [timeZone]);

  const updateQueryParams = (updates: {
    date?: string;
    time?: string;
    software?: string[];
    laboratoryId?: string | null;
    capacity?: string;
  }) => {
    const params = new URLSearchParams(searchParams.toString());

    if (updates.date) {
      params.set("date", updates.date);
    }

    if (typeof updates.time === "string") {
      if (updates.time) {
        params.set("time", updates.time);
      } else {
        params.delete("time");
      }
    }

    params.delete("software");
    updates.software?.forEach((softwareId) => params.append("software", softwareId));

    if (typeof updates.capacity === "string") {
      const trimmed = updates.capacity.trim();
      if (trimmed.length > 0) {
        params.set("capacity", trimmed);
      } else {
        params.delete("capacity");
      }
    }

    if (updates.laboratoryId === null) {
      params.delete("laboratoryId");
    } else if (typeof updates.laboratoryId === "string") {
      params.set("laboratoryId", updates.laboratoryId);
    }

    router.push(`/dashboard/scheduling?${params.toString()}`);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateQueryParams({
      date: selectedDate,
      time: selectedTime,
      software: softwareSelection,
      laboratoryId: null,
      capacity: capacityFilter,
    });
  };

  const handleReset = () => {
    setSelectedDate(date);
    setSelectedTime("");
    setSoftwareSelection([]);
    setCapacityFilter("");
    updateQueryParams({
      date,
      time: "",
      software: [],
      laboratoryId: null,
      capacity: "",
    });
  };

  const handleSelectLaboratory = (laboratoryId: string) => {
    updateQueryParams({
      date: selectedDate,
      time: selectedTime,
      software: softwareSelection,
      laboratoryId,
      capacity: capacityFilter,
    });
  };

  return (
    <section className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Encontre um laboratório disponível</CardTitle>
          <CardDescription>
            Combine data, horário e softwares instalados para localizar rapidamente o laboratório ideal antes de iniciar a reserva.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="scheduling-date">Data desejada</Label>
                <Input
                  id="scheduling-date"
                  type="date"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="scheduling-time">Horário inicial (opcional)</Label>
                <Input
                  id="scheduling-time"
                  type="time"
                  value={selectedTime}
                  onChange={(event) => setSelectedTime(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="laboratory-capacity">Capacidade mínima (opcional)</Label>
                <Input
                  id="laboratory-capacity"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  placeholder="Ex.: 20"
                  value={capacityFilter}
                  onChange={(event) => {
                    const digitsOnly = event.target.value.replace(/\D/g, "");
                    setCapacityFilter(digitsOnly.replace(/^0+(?=\d)/, ""));
                  }}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Softwares necessários</Label>
              <MultiCombobox
                name="software"
                options={comboboxOptions}
                value={softwareSelection}
                onChange={setSoftwareSelection}
                placeholder="Selecione softwares instalados"
                searchPlaceholder="Pesquisar softwares..."
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Buscando laboratórios...
                  </span>
                ) : (
                  "Buscar laboratórios"
                )}
              </Button>
              <Button type="button" variant="outline" onClick={handleReset}>
                Limpar filtros
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Carregando laboratórios disponíveis...
          </div>
        ) : results.length === 0 ? (
          <div className="flex items-center gap-3 rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            <CalendarSearch className="h-4 w-4" aria-hidden />
            Nenhum laboratório atende aos critérios informados ou não há laboratórios ativos disponíveis no momento. Ajuste os filtros e tente novamente.
          </div>
        ) : (
          results.map((laboratory) => {
            const isSelected = laboratory.id === selectedLaboratoryId;
            const remainingSlots = Math.max(
              0,
              laboratory.totalMatchingSlots - laboratory.availableSlots.length,
            );

            return (
              <Card
                key={laboratory.id}
                className={cn(
                  "border-border/60 transition-shadow hover:shadow-md",
                  isSelected ? "border-primary/60 ring-1 ring-primary/30" : "",
                )}
              >
                <CardHeader className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-xl">{laboratory.name}</CardTitle>
                    <CardDescription>
                      Capacidade para {laboratory.capacity} estação{laboratory.capacity === 1 ? "" : "s"}.
                    </CardDescription>
                    {laboratory.software.length > 0 ? (
                      <div className="flex flex-wrap gap-2 pt-2">
                        {laboratory.software.slice(0, 6).map((software) => (
                          <span
                            key={software.id}
                            className="inline-flex items-center rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground"
                          >
                            {software.name} • {software.version}
                          </span>
                        ))}
                        {laboratory.software.length > 6 ? (
                          <span className="text-xs text-muted-foreground">
                            + {laboratory.software.length - 6} software(s)
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Nenhum software cadastrado.</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant={isSelected ? "default" : "outline"}
                    onClick={() => handleSelectLaboratory(laboratory.id)}
                  >
                    {isSelected ? "Selecionado" : "Selecionar laboratório"}
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Horários compatíveis em {formatDateForDisplay(selectedDate)}
                    </p>
                    <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {laboratory.availableSlots.map((slot) => {
                        const startLabel = timeFormatter.format(new Date(slot.startTime));
                        const endLabel = timeFormatter.format(new Date(slot.endTime));

                        return (
                          <li
                            key={slot.startTime}
                            className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm text-muted-foreground"
                          >
                            <p className="font-medium text-foreground">
                              {startLabel} - {endLabel}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Período {translatePeriod(slot.periodId)} • Aula {slot.classIndex}
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                    {remainingSlots > 0 ? (
                      <p className="pt-2 text-xs text-muted-foreground">
                        + {remainingSlots} horário{remainingSlots === 1 ? "" : "s"} adicional{remainingSlots === 1 ? "" : "is"} disponível{remainingSlots === 1 ? "" : "s"}.
                      </p>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </section>
  );
}

function translatePeriod(periodId: SchedulingLaboratorySearchResult["availableSlots"][number]["periodId"]): string {
  switch (periodId) {
    case "morning":
      return "Matutino";
    case "afternoon":
      return "Vespertino";
    case "evening":
      return "Noturno";
    default:
      return periodId;
  }
}

function formatDateForDisplay(date: string): string {
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });

  const [year, month, day] = date.split("-").map((value) => Number.parseInt(value, 10));
  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day)
  ) {
    return date;
  }

  return formatter.format(new Date(Date.UTC(year, month - 1, day)));
}
