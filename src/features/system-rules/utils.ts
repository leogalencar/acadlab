import { MINUTES_PER_DAY } from "@/features/system-rules/constants";

interface IntervalDurationLike {
  durationMinutes: number;
}

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
  intervals: IntervalDurationLike[],
): number {
  const totalIntervalDuration = intervals.reduce(
    (accumulator, interval) => accumulator + interval.durationMinutes,
    0,
  );

  return startMinutes + classDurationMinutes * classesCount + totalIntervalDuration;
}

export function getReadableTextColor(hexColor: string): string {
  const [red, green, blue] = parseHexColor(hexColor);

  const luminance = calculateRelativeLuminance(red, green, blue);

  return luminance > 0.55 ? "#000000" : "#FFFFFF";
}

function channelToHex(value: number): string {
  const clamped = Math.max(0, Math.min(255, Math.round(value)));
  return clamped.toString(16).padStart(2, "0").toUpperCase();
}

function rgbToHex(red: number, green: number, blue: number): string {
  return `#${channelToHex(red)}${channelToHex(green)}${channelToHex(blue)}`;
}

function normalizeHexColor(hexColor: string): string {
  const [red, green, blue] = parseHexColor(hexColor);
  return rgbToHex(red, green, blue);
}

export function buildPaletteCssVariables(colors: {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  successColor: string;
  warningColor: string;
  infoColor: string;
  dangerColor: string;
}): Record<string, string> {
  const primary = normalizeHexColor(colors.primaryColor || "#1D4ED8");
  const secondary = normalizeHexColor(colors.secondaryColor || "#1E293B");
  const accent = normalizeHexColor(colors.accentColor || "#F97316");
  const success = normalizeHexColor(colors.successColor || "#059669");
  const warning = normalizeHexColor(colors.warningColor || "#F59E0B");
  const info = normalizeHexColor(colors.infoColor || "#0EA5E9");
  const danger = normalizeHexColor(colors.dangerColor || "#DC2626");

  const baseBackground = "#FFFFFF";
  const baseForeground = "#111827";
  const darkBackground = "#0F172A";
  const darkForeground = "#F8FAFC";

  return {
    "--primary-base": primary,
    "--primary-foreground-base": getReadableTextColor(primary),
    "--secondary-base": secondary,
    "--accent-base": accent,
    "--sidebar-base": secondary,
    "--theme-light-background": baseBackground,
    "--theme-light-foreground": baseForeground,
    "--theme-dark-background": darkBackground,
    "--theme-dark-foreground": darkForeground,
    "--theme-success": success,
    "--theme-success-foreground": getReadableTextColor(success),
    "--theme-warning": warning,
    "--theme-warning-foreground": getReadableTextColor(warning),
    "--theme-info": info,
    "--theme-info-foreground": getReadableTextColor(info),
    "--theme-danger": danger,
    "--theme-danger-foreground": getReadableTextColor(danger),
  };
}

export function extractEmailDomain(email: string): string | null {
  const atIndex = email.lastIndexOf("@");

  if (atIndex < 0 || atIndex === email.length - 1) {
    return null;
  }

  return email.slice(atIndex + 1).toLowerCase();
}

function parseHexColor(hexColor: string): [number, number, number] {
  const sanitized = hexColor.trim().toLowerCase();
  const match = sanitized.match(/^#?([0-9a-f]{6})$/);

  if (!match) {
    return [0, 0, 0];
  }

  const value = match[1];

  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);

  return [red, green, blue];
}

function calculateRelativeLuminance(red: number, green: number, blue: number): number {
  const normalizedRed = srgbToLinear(red / 255);
  const normalizedGreen = srgbToLinear(green / 255);
  const normalizedBlue = srgbToLinear(blue / 255);

  return 0.2126 * normalizedRed + 0.7152 * normalizedGreen + 0.0722 * normalizedBlue;
}

function srgbToLinear(value: number): number {
  if (value <= 0.04045) {
    return value / 12.92;
  }

  return ((value + 0.055) / 1.055) ** 2.4;
}
