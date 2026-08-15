// Pure logic only — no Prisma, no DB, no `new Date()`. Every notion of "now"
// comes in as the `now` parameter so this stays deterministic and testable.
import {
  timeStringToMinutes,
  minutesToTimeString,
  toBangkokParts,
  calendarDateParts,
  calendarDaysBetween,
  bangkokWallTimeToInstant,
} from "@/lib/datetime";

export type GenerateSlotsInput = {
  openingHour: { openTime: string; closeTime: string; isClosed: boolean };
  settings: { slotDuration: number; capacityPerSlot: number; minLeadHours: number; advanceDays: number };
  date: Date;
  now: Date;
  isClosureDay: boolean;
  bookedMap: Record<string, number>;
};

export type Slot = {
  time: string;
  capacity: number;
  booked: number;
  available: number;
};

export function generateSlots(input: GenerateSlotsInput): Slot[] {
  const { openingHour, settings, date, now, isClosureDay, bookedMap } = input;

  if (openingHour.isClosed || isClosureDay) {
    return [];
  }

  // A non-positive slotDuration would make the slicing loop below never
  // advance (0) or never terminate (negative) — an unrecoverable CPU hang,
  // not a catchable error. Reject before the loop can ever start.
  if (settings.slotDuration <= 0) {
    return [];
  }

  const todayParts = toBangkokParts(now);
  const dateParts = calendarDateParts(date);
  const daysAhead = calendarDaysBetween(todayParts, dateParts);

  // A date more than one calendar day behind today is unambiguously past —
  // reject outright. Exactly one day behind is *not* rejected here: that's
  // also what a cross-midnight business day (rule 7) looks like from
  // today's side once the Bangkok calendar has ticked past midnight, and
  // its overflow slots (e.g. date's 01:00, which is a real instant on the
  // following calendar day) can still be genuinely in the future. The
  // per-slot instant check below (rule 3) is what actually decides —
  // for an ordinary non-crossing date exactly one day back, every one of
  // its slots is already a past instant and gets cut there anyway.
  if (daysAhead < -1) {
    return [];
  }
  if (daysAhead > settings.advanceDays) {
    return [];
  }

  const openMinutes = timeStringToMinutes(openingHour.openTime);
  let closeMinutes = timeStringToMinutes(openingHour.closeTime);
  const crossesMidnight = closeMinutes < openMinutes;
  if (crossesMidnight) {
    closeMinutes += 24 * 60;
  }

  const leadMs = settings.minLeadHours * 60 * 60_000;
  const slots: Slot[] = [];

  for (let start = openMinutes; start + settings.slotDuration <= closeMinutes; start += settings.slotDuration) {
    const slotInstant = bangkokWallTimeToInstant(date, start);

    // Rule 3: already-passed slots.
    if (slotInstant.getTime() <= now.getTime()) {
      continue;
    }
    // Rule 4: inside the minimum lead-time window.
    if (slotInstant.getTime() - now.getTime() < leadMs) {
      continue;
    }

    const time = minutesToTimeString(start);
    const booked = bookedMap[time] ?? 0;
    const capacity = settings.capacityPerSlot;
    slots.push({ time, capacity, booked, available: Math.max(0, capacity - booked) });
  }

  return slots;
}
