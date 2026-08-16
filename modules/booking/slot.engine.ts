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

type OpeningWindow = { openTime: string; closeTime: string };

/**
 * openMinutes/closeMinutes/crossesMidnight for one opening-hour row, with
 * closeMinutes already extended past 1439 when the window crosses
 * midnight. Single source of truth for "does this window cross midnight" —
 * generateSlots (below) and resolveSlotStartMinutes both go through this,
 * never re-derive crossesMidnight independently.
 */
function resolveOpeningWindow(openingHour: OpeningWindow): {
  openMinutes: number;
  closeMinutes: number;
  crossesMidnight: boolean;
} {
  const openMinutes = timeStringToMinutes(openingHour.openTime);
  let closeMinutes = timeStringToMinutes(openingHour.closeTime);
  const crossesMidnight = closeMinutes < openMinutes;
  if (crossesMidnight) {
    closeMinutes += 24 * 60;
  }
  return { openMinutes, closeMinutes, crossesMidnight };
}

/**
 * Inverse of the `time = minutesToTimeString(start)` step below: recovers
 * the *unwrapped* minutes-since-midnight (may exceed 1439) a stored
 * "HH:MM" slotTime represents, given the opening hours it was generated
 * under. Needed because generateSlots wraps `start` back into 0-23:59 for
 * display/storage — a booking's row only ever has the wrapped string, so
 * anything that later needs the slot's *real instant* (e.g.
 * changeBookingStatus's minLeadHours deadline) must unwrap it the same way
 * it was wrapped, or a cross-midnight overflow slot like "01:00" gets
 * misread as 01:00 *that same day* instead of the following one.
 */
export function resolveSlotStartMinutes(openingHour: OpeningWindow, slotTime: string): number {
  const { openMinutes, crossesMidnight } = resolveOpeningWindow(openingHour);
  const slotMinutes = timeStringToMinutes(slotTime);
  return crossesMidnight && slotMinutes < openMinutes ? slotMinutes + 24 * 60 : slotMinutes;
}

/** The real instant a stored (bookingDate, slotTime) pair refers to. */
export function computeSlotInstant(date: Date, openingHour: OpeningWindow, slotTime: string): Date {
  return bangkokWallTimeToInstant(date, resolveSlotStartMinutes(openingHour, slotTime));
}

type OpeningHourWithClosed = OpeningWindow & { isClosed: boolean };

/**
 * Whether a restaurant is open right now, for an "open / closed now" badge
 * on a restaurant list card. Needs *two* rows, not one: a business day that
 * crosses midnight (rule 7) is keyed by the day it *started* on, so being
 * open at, say, 01:00 on a Tuesday can mean either "Tuesday's own hours
 * already started" or "Monday's overnight hours haven't ended yet" —
 * checking only todayRow misses the second case entirely. Same
 * resolveOpeningWindow the rest of this file uses, so this can never
 * disagree with generateSlots about what "crosses midnight" means.
 */
export function isOpenNow(
  todayRow: OpeningHourWithClosed,
  yesterdayRow: OpeningHourWithClosed,
  now: Date
): boolean {
  const nowMinutes = toBangkokParts(now).minutesSinceMidnight;

  if (!yesterdayRow.isClosed) {
    const { closeMinutes, crossesMidnight } = resolveOpeningWindow(yesterdayRow);
    // closeMinutes was pushed past 1439 by resolveOpeningWindow when
    // crossing — subtracting a day back off it recovers how far into
    // *today* yesterday's overnight window still reaches.
    if (crossesMidnight && nowMinutes < closeMinutes - 24 * 60) {
      return true;
    }
  }

  if (!todayRow.isClosed) {
    const { openMinutes, closeMinutes, crossesMidnight } = resolveOpeningWindow(todayRow);
    if (nowMinutes >= openMinutes && (crossesMidnight || nowMinutes < closeMinutes)) {
      return true;
    }
  }

  return false;
}

export type SlotBookability =
  | { bookable: true }
  | { bookable: false; reason: "past" | "full" | "insufficient_party_size" };

/**
 * Whether a slot the API already returned can actually be selected for a
 * given party size, right now. `generateSlots` above never returns a
 * genuinely past or lead-time-blocked slot in the first place, but a slot
 * list fetched a while ago can still go stale in the browser while the tab
 * stays open (real time marches past `slotInstant`) or while the visitor
 * changes party size after already picking a slot — both need re-checking
 * against the *current* moment and the *current* party size, not just
 * `available > 0`. Single source of truth for that decision so the UI
 * (app/restaurants/[id]/booking-box.tsx) never re-derives it ad hoc.
 */
export function resolveSlotBookability(
  slot: Slot,
  partySize: number,
  slotInstant: Date,
  now: Date
): SlotBookability {
  if (slotInstant.getTime() <= now.getTime()) {
    return { bookable: false, reason: "past" };
  }
  if (slot.available <= 0) {
    return { bookable: false, reason: "full" };
  }
  if (slot.available < partySize) {
    return { bookable: false, reason: "insufficient_party_size" };
  }
  return { bookable: true };
}

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

  const { openMinutes, closeMinutes } = resolveOpeningWindow(openingHour);

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
