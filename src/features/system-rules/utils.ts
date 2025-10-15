import { MINUTES_PER_DAY } from "@/features/system-rules/constants";

export function parseTimeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  const total = hours * 60 + minutes;
  if (!Number.isFinite(total) || total < 0 || total >= MINUTES_PER_DAY) {
    throw new Error("Horário inválido.");
  }
  return total;
}

export function formatMinutesToTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function calculatePeriodEnd(
  startMinutes: number,
  classDurationMinutes: number,
  classesCount: number,
  intervalDurationMinutes: number,
): number {
  return startMinutes + classDurationMinutes * classesCount + intervalDurationMinutes;
}
