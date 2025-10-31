"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getIsoDateInTimeZone } from "@/features/scheduling/utils";
import { cn } from "@/lib/utils";

type CalendarHighlightVariant = "reserved" | "nonTeaching";

export interface CalendarDayState {
  disabled?: boolean;
  highlight?: CalendarHighlightVariant;
  hint?: string;
}

interface DatePickerCalendarProps {
  selectedDate: string;
  onSelect: (date: string) => void;
  getDayState?: (isoDate: string) => CalendarDayState | undefined;
  timeZone: string;
}

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function DatePickerCalendar({
  selectedDate,
  onSelect,
  getDayState,
  timeZone,
}: DatePickerCalendarProps) {
  const initialMonth = useMemo(() => startOfMonth(parseIsoDate(selectedDate)), [selectedDate]);
  const [visibleMonth, setVisibleMonth] = useState(initialMonth);

  useEffect(() => {
    setVisibleMonth(initialMonth);
  }, [initialMonth]);

  const calendarDays = useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth]);
  const selectedIso = normalizeDate(selectedDate);
  const todayIso = normalizeDate(getIsoDateInTimeZone(new Date(), timeZone));

  const monthLabel = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(visibleMonth);

  const handlePrevious = () => {
    setVisibleMonth((current) => addMonths(current, -1));
  };

  const handleNext = () => {
    setVisibleMonth((current) => addMonths(current, 1));
  };

  return (
    <div className="w-full rounded-lg border border-border/60 bg-background/95 shadow-sm">
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground"
          onClick={handlePrevious}
          aria-label="Mês anterior"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </Button>
        <div className="text-sm font-semibold capitalize text-foreground">
          {monthLabel}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground"
          onClick={handleNext}
          aria-label="Próximo mês"
        >
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 px-3 py-2 text-xs font-medium text-muted-foreground">
        {WEEKDAY_LABELS.map((weekday) => (
          <div key={weekday} className="text-center uppercase tracking-wide">
            {weekday}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 px-3 pb-3">
        {calendarDays.map((day) => {
          const isoDate = normalizeDate(day.date.toISOString().slice(0, 10));
          const isSelected = isoDate === selectedIso;
          const isToday = isoDate === todayIso;
          const dayState = getDayState?.(isoDate);
          const isDisabled = Boolean(dayState?.disabled);

          return (
            <button
              key={isoDate + (day.currentMonth ? "current" : "other")}
              type="button"
              onClick={() => {
                if (isDisabled) {
                  return;
                }
                onSelect(isoDate);
              }}
              className={cn(
                "group relative flex h-9 w-full items-center justify-center rounded-md text-sm transition-all",
                day.currentMonth
                  ? "text-foreground hover:bg-primary/10"
                  : "text-muted-foreground/50 hover:bg-muted/40",
                isSelected && "bg-primary text-primary-foreground shadow-sm hover:bg-primary",
                !day.currentMonth && isSelected && "opacity-90",
                isToday && !isSelected && "border border-primary/40",
                isDisabled &&
                  "cursor-not-allowed text-muted-foreground/60 opacity-60 hover:bg-transparent",
                dayState?.highlight === "reserved" &&
                  !isSelected &&
                  !isDisabled &&
                  "bg-success/10 text-success-foreground hover:bg-success/20",
                dayState?.highlight === "nonTeaching" &&
                  !isSelected &&
                  "bg-destructive/10 text-destructive hover:bg-destructive/15",
              )}
              aria-disabled={isDisabled}
              disabled={isDisabled}
              title={dayState?.hint}
            >
              <span>{day.date.getUTCDate()}</span>
              {dayState?.highlight === "reserved" && !isSelected ? (
                <span className="absolute bottom-1.5 h-1.5 w-1.5 rounded-full bg-success"></span>
              ) : null}
              {dayState?.highlight === "nonTeaching" && !isSelected ? (
                <span className="absolute bottom-1.5 h-1.5 w-1.5 rounded-full bg-destructive"></span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface CalendarDay {
  date: Date;
  currentMonth: boolean;
}

function buildCalendarDays(monthDate: Date): CalendarDay[] {
  const year = monthDate.getUTCFullYear();
  const month = monthDate.getUTCMonth();
  const firstDayOfMonth = new Date(Date.UTC(year, month, 1));
  const firstWeekday = firstDayOfMonth.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  const days: CalendarDay[] = [];

  const previousMonthDays = firstWeekday;
  for (let index = previousMonthDays; index > 0; index -= 1) {
    const date = new Date(Date.UTC(year, month, 1 - index));
    days.push({ date, currentMonth: false });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(Date.UTC(year, month, day));
    days.push({ date, currentMonth: true });
  }

  const totalCells = Math.ceil(days.length / 7) * 7;
  const remaining = totalCells - days.length;
  for (let index = 1; index <= remaining; index += 1) {
    const date = new Date(Date.UTC(year, month + 1, index));
    days.push({ date, currentMonth: false });
  }

  return days;
}

function parseIsoDate(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00.000Z`);
  }

  return new Date();
}

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  return result;
}

function normalizeDate(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return new Date().toISOString().slice(0, 10);
  }
  return value;
}
