import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const DEFAULT_DATE_FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>()

type ResolvedDateInput = string | number | Date | null | undefined

function getDateFormatter(locale: string, options: Intl.DateTimeFormatOptions) {
  const cacheKey = `${locale}_${JSON.stringify(options)}`
  const formatter = DEFAULT_DATE_FORMATTER_CACHE.get(cacheKey)
  if (formatter) {
    return formatter
  }
  const instance = new Intl.DateTimeFormat(locale, options)
  DEFAULT_DATE_FORMATTER_CACHE.set(cacheKey, instance)
  return instance
}

export function formatDate(
  value: ResolvedDateInput,
  {
    locale = "pt-BR",
    options = {},
  }: { locale?: string; options?: Intl.DateTimeFormatOptions } = {},
): string {
  if (value === null || value === undefined || value === "") {
    return ""
  }

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ""
  }

  const formatter = getDateFormatter(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...options,
  })

  return formatter.format(date)
}
