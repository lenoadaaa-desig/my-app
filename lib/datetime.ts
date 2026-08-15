// Asia/Bangkok has held a fixed UTC+7 offset since 1920 and never observes
// daylight saving, so a constant offset is correct forever — no ICU/tz-db
// lookup needed, and the arithmetic stays trivially testable.
const BANGKOK_UTC_OFFSET_MINUTES = 7 * 60;

export function timeStringToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/** Formats minutes-since-midnight as "HH:MM", wrapping values outside 0-1439 back into a day. */
export function minutesToTimeString(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export type BangkokDateParts = {
  year: number;
  month: number;
  day: number;
  minutesSinceMidnight: number;
};

/** Reads the Bangkok wall-clock date/time components of a real instant. */
export function toBangkokParts(instant: Date): BangkokDateParts {
  const shifted = new Date(instant.getTime() + BANGKOK_UTC_OFFSET_MINUTES * 60_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    minutesSinceMidnight: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

/** y/m/d of a pure calendar date value (e.g. a Prisma `@db.Date` field) — not a timezone-aware instant. */
export function calendarDateParts(date: Date): { year: number; month: number; day: number } {
  return { year: date.getUTCFullYear(), month: date.getUTCMonth(), day: date.getUTCDate() };
}

/** Whole-day difference between two calendar dates, b - a. */
export function calendarDaysBetween(
  a: { year: number; month: number; day: number },
  b: { year: number; month: number; day: number }
): number {
  const aMs = Date.UTC(a.year, a.month, a.day);
  const bMs = Date.UTC(b.year, b.month, b.day);
  return Math.round((bMs - aMs) / 86_400_000);
}

/**
 * Converts a Bangkok wall-clock date + minutes-since-midnight into the real
 * UTC instant it refers to. `calendarDate` is a pure calendar date (read via
 * its own UTC y/m/d). `minutesSinceMidnight` may exceed 1439 (e.g. 1500 for
 * 01:00 the next day) to express a slot that crosses midnight while still
 * belonging to `calendarDate`.
 */
export function bangkokWallTimeToInstant(calendarDate: Date, minutesSinceMidnight: number): Date {
  const { year, month, day } = calendarDateParts(calendarDate);
  const midnightUtcMs = Date.UTC(year, month, day);
  return new Date(midnightUtcMs + minutesSinceMidnight * 60_000 - BANGKOK_UTC_OFFSET_MINUTES * 60_000);
}

const DATE_STRING_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parses a strict "YYYY-MM-DD" string into a UTC-midnight Date — the same
 * shape Prisma returns for `@db.Date` columns. Returns null for anything
 * that isn't a real calendar date in that exact format (wrong shape, or a
 * shape-valid but nonexistent date like "2026-13-45") — never silently
 * produces an Invalid Date. Deliberately does not use `new Date(value)`:
 * that accepts many looser formats (and, without a "Z"/time component,
 * some engines parse it in the local timezone instead of UTC).
 */
export function parseCalendarDateString(value: string): Date | null {
  if (!DATE_STRING_PATTERN.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  // Date.UTC silently rolls invalid components forward (month 13 -> next
  // January, day 45 -> rolls into a later month) instead of erroring, so
  // round-trip the result and reject if it doesn't match what was typed.
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }

  return date;
}

/**
 * Day of week (0 = Sunday ... 6 = Saturday, matching OpeningHour.dayOfWeek)
 * of a pure calendar date value. Uses the UTC getter — never `.getDay()`
 * (local) — since `date` itself carries no timezone-dependent information,
 * only a calendar date.
 */
export function calendarDayOfWeek(date: Date): number {
  return date.getUTCDay();
}
