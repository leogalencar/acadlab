"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DatePickerCalendarProps {
  selectedDate: string;
  fullyBookedDates: string[];
  timeZone: string;
  onSelect: (date: string) => void;
  highlightedDates?: string[];
}

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function DatePickerCalendar({
  selectedDate,
  fullyBookedDates,
  timeZone,
  onSelect,
  highlightedDates = [],
}: DatePickerCalendarProps) {
  const initialMonth = useMemo(() => getMonthPointerFromIso(selectedDate), [selectedDate]);
  const [visibleMonth, setVisibleMonth] = useState<MonthPointer>(initialMonth);
  const fullyBookedSet = useMemo(
    () => new Set(fullyBookedDates.map((date) => normalizeDate(date))),
    [fullyBookedDates],
  );
  const highlightedSet = useMemo(
    () => new Set(highlightedDates.map((date) => normalizeDate(date))),
    [highlightedDates],
  );

  useEffect(() => {
    setVisibleMonth(initialMonth);
  }, [initialMonth]);

  const calendarDays = useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth]);
  const selectedIso = normalizeDate(selectedDate);
  const todayIso = useMemo(() => formatDateInTimeZone(new Date(), timeZone), [timeZone]);

  const monthLabel = useMemo(() => {
    const referenceDate = new Date(Date.UTC(visibleMonth.year, visibleMonth.month - 1, 1));
    return new Intl.DateTimeFormat("pt-BR", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(referenceDate);
  }, [visibleMonth]);

  const handlePrevious = () => {
    setVisibleMonth((current) => shiftMonthPointer(current, -1));
  };

  const handleNext = () => {
    setVisibleMonth((current) => shiftMonthPointer(current, 1));
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
          const isoDate = normalizeDate(day.isoDate);
          const isSelected = isoDate === selectedIso;
          const isToday = isoDate === todayIso;
          const isPast = isoDate < todayIso;
          const isFullyBooked = fullyBookedSet.has(isoDate);
          const isHighlighted = highlightedSet.has(isoDate);
          const isDisabled = isPast || isFullyBooked;

          return (
            <button
              key={isoDate}
              type="button"
              onClick={() => {
                if (!isDisabled) {
                  onSelect(isoDate);
                }
              }}
              disabled={isDisabled}
              aria-disabled={isDisabled}
              title={
                isFullyBooked
                  ? "Todos os horários estão reservados para esta data."
                  : isPast
                    ? "Datas passadas não estão disponíveis."
                    : undefined
              }
              className={cn(
                "flex h-9 w-full items-center justify-center rounded-md text-sm transition-colors",
                day.currentMonth
                  ? "text-foreground hover:bg-primary/10"
                  : "text-muted-foreground/50 hover:bg-muted/40",
                isSelected && "bg-primary text-primary-foreground hover:bg-primary",
                !day.currentMonth && isSelected && "opacity-90",
                isToday && !isSelected && "border border-primary/40",
                isDisabled &&
                  (isFullyBooked
                    ? "cursor-not-allowed bg-destructive/10 text-destructive hover:bg-destructive/10"
                    : "cursor-not-allowed bg-muted/60 text-muted-foreground/70 hover:bg-muted/60 hover:text-muted-foreground/70"),
                !isDisabled && isHighlighted && !isSelected && "border border-primary/40 bg-primary/10 text-primary",
              )}
            >
              <span>{day.dayNumber}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface MonthPointer {
  year: number;
  month: number; // 1-12
}

interface CalendarDay {
  isoDate: string;
  dayNumber: number;
  currentMonth: boolean;
}

function getMonthPointerFromIso(isoDate: string): MonthPointer {
  const match = isoDate.match(/^(\d{4})-(\d{2})/);
  if (!match) {
    const today = new Date();
    return {
      year: today.getUTCFullYear(),
      month: today.getUTCMonth() + 1,
    };
  }

  const year = Number.parseInt(match[1]!, 10);
  const month = Number.parseInt(match[2]!, 10);

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    const today = new Date();
    return {
      year: today.getUTCFullYear(),
      month: today.getUTCMonth() + 1,
    };
  }

  return { year, month: Math.min(Math.max(month, 1), 12) };
}

function buildCalendarDays(monthPointer: MonthPointer): CalendarDay[] {
  const { year, month } = monthPointer;
  const firstWeekday = getWeekday(year, month, 1);
  const daysInMonth = getDaysInMonth(year, month);
  const previousMonth = shiftMonthPointer(monthPointer, -1);
  const previousMonthDays = getDaysInMonth(previousMonth.year, previousMonth.month);

  const days: CalendarDay[] = [];

  for (let index = firstWeekday; index > 0; index -= 1) {
    const dayNumber = previousMonthDays - index + 1;
    days.push({
      isoDate: formatIsoDate(previousMonth.year, previousMonth.month, dayNumber),
      dayNumber,
      currentMonth: false,
    });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push({
      isoDate: formatIsoDate(year, month, day),
      dayNumber: day,
      currentMonth: true,
    });
  }

  const totalCells = Math.ceil(days.length / 7) * 7;
  const remaining = totalCells - days.length;

  const nextMonth = shiftMonthPointer(monthPointer, 1);
  for (let index = 1; index <= remaining; index += 1) {
    days.push({
      isoDate: formatIsoDate(nextMonth.year, nextMonth.month, index),
      dayNumber: index,
      currentMonth: false,
    });
  }

  return days;
}

function shiftMonthPointer(month: MonthPointer, offset: number): MonthPointer {
  let year = month.year;
  let newMonth = month.month + offset;

  while (newMonth > 12) {
    newMonth -= 12;
    year += 1;
  }

  while (newMonth < 1) {
    newMonth += 12;
    year -= 1;
  }

  return { year, month: newMonth };
}

function getWeekday(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCDay();
}

function getDaysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function formatIsoDate(year: number, month: number, day: number) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatDateInTimeZone(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(date);
}

function normalizeDate(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return new Date().toISOString().slice(0, 10);
  }
  return value;
}
