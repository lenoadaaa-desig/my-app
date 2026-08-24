import { MONTH_SHORT_TH } from "@/constants/messages";

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

/** Inverse of parseCalendarDateString — formats a pure calendar date value back to "YYYY-MM-DD" via the same UTC y/m/d reading, so the round trip is exact. */
export function formatCalendarDateString(date: Date): string {
  const { year, month, day } = calendarDateParts(date);
  return `${String(year).padStart(4, "0")}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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

/**
 * Today's calendar date in Asia/Bangkok, as a pure calendar date value (same
 * UTC-midnight shape parseCalendarDateString returns) — not the visitor's
 * local timezone. Both the restaurant detail page (server) and its booking
 * widget (client) need "today" to build their date picker from the same
 * definition of "today" the booking engine itself uses, so this lives here
 * rather than being reimplemented on either side. `now` defaults to the
 * real clock but can be overridden, same convention as slot.engine.ts.
 */
export function bangkokToday(now: Date = new Date()): Date {
  const parts = toBangkokParts(now);
  return new Date(Date.UTC(parts.year, parts.month, parts.day));
}

/**
 * The single source of truth for "day month year" display strings in the
 * admin pages (e.g. "19 ส.ค. 2026") — always the Gregorian year, never พ.ศ.
 * (see CLAUDE.md's architecture-decision note on why). Three separate admin
 * pages each hand-rolled their own version of this before it was pulled out
 * here; one of them used `Date.prototype.toLocaleDateString("th-TH", ...)`,
 * which silently switches to the Buddhist calendar because that's `th-TH`'s
 * ICU default — this function never delegates to `toLocaleDateString` for
 * exactly that reason. Takes calendar parts (not a raw `Date`) so both a
 * real timestamp (via toBangkokParts) and an already-parsed "YYYY-MM-DD"
 * key (e.g. dashboard.service.ts's per-day trend, keyed as a string rather
 * than a Date so it can double as a stable Map key) can share the same
 * formatter — see formatThaiDate below for the common instant case.
 */
export function formatThaiDateParts(parts: { year: number; month: number; day: number }): string {
  return `${parts.day} ${MONTH_SHORT_TH[parts.month]} ${parts.year}`;
}

/** formatThaiDateParts for a real instant (DateTime column) — Bangkok-aware via toBangkokParts. */
export function formatThaiDate(instant: Date): string {
  return formatThaiDateParts(toBangkokParts(instant));
}

/**
 * "day month", no year — for contexts where every row is already known to
 * be within the same year (e.g. the admin dashboard's 30-day trend), where
 * repeating the year on every row would just be clutter, not the ค.ศ./พ.ศ.
 * concern formatThaiDateParts exists for.
 */
export function formatThaiDayMonthParts(parts: { month: number; day: number }): string {
  return `${parts.day} ${MONTH_SHORT_TH[parts.month]}`;
}
