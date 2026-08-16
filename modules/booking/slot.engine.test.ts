import { describe, it, expect } from "vitest";
import {
  generateSlots,
  resolveSlotStartMinutes,
  computeSlotInstant,
  resolveSlotBookability,
  isOpenNow,
} from "./slot.engine";
import { bangkokWallTimeToInstant } from "@/lib/datetime";

// `month` is 1-indexed here for readability, unlike the native Date API.
function calendarDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

function bkk(year: number, month: number, day: number, hour: number, minute: number): Date {
  return bangkokWallTimeToInstant(calendarDate(year, month, day), hour * 60 + minute);
}

const baseSettings = { slotDuration: 60, capacityPerSlot: 4, minLeadHours: 0, advanceDays: 30 };
const openingHour = { openTime: "10:00", closeTime: "21:00", isClosed: false };
const farPastNow = bkk(2026, 8, 1, 0, 0); // well before any test date below, nothing gets cut by rule 3/4

describe("rule 1: closed days return []", () => {
  it("isClosed on the opening hour", () => {
    const result = generateSlots({
      openingHour: { ...openingHour, isClosed: true },
      settings: baseSettings,
      date: calendarDate(2026, 8, 20),
      now: farPastNow,
      isClosureDay: false,
      bookedMap: {},
    });
    expect(result).toEqual([]);
  });

  it("isClosureDay, even though the opening hour itself is open", () => {
    const result = generateSlots({
      openingHour,
      settings: baseSettings,
      date: calendarDate(2026, 8, 20),
      now: farPastNow,
      isClosureDay: true,
      bookedMap: {},
    });
    expect(result).toEqual([]);
  });
});

describe("rule 2: slicing into slots", () => {
  it("10:00-21:00 at 60min produces hourly slots ending no later than close, last slot 20:00", () => {
    const result = generateSlots({
      openingHour,
      settings: baseSettings,
      date: calendarDate(2026, 8, 20),
      now: farPastNow,
      isClosureDay: false,
      bookedMap: {},
    });
    expect(result.map((s) => s.time)).toEqual([
      "10:00", "11:00", "12:00", "13:00", "14:00",
      "15:00", "16:00", "17:00", "18:00", "19:00", "20:00",
    ]);
  });
});

describe("rule 3: cuts slots already passed relative to now", () => {
  it("drops slots at/before now, keeps the rest", () => {
    const result = generateSlots({
      openingHour: { openTime: "10:00", closeTime: "22:00", isClosed: false },
      settings: { ...baseSettings, minLeadHours: 0 },
      date: calendarDate(2026, 8, 20),
      now: bkk(2026, 8, 20, 14, 30),
      isClosureDay: false,
      bookedMap: {},
    });
    expect(result.map((s) => s.time)).toEqual(["15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00"]);
  });
});

describe("rule 4: minLeadHours cuts slots inside the lead window", () => {
  it("drops a technically-future slot that's still within minLeadHours", () => {
    const result = generateSlots({
      openingHour: { openTime: "10:00", closeTime: "22:00", isClosed: false },
      settings: { ...baseSettings, minLeadHours: 1 },
      date: calendarDate(2026, 8, 20),
      now: bkk(2026, 8, 20, 14, 30), // 15:00 is only 30min away, also cut
      isClosureDay: false,
      bookedMap: {},
    });
    expect(result[0].time).toBe("16:00");
  });
});

describe("rule 5: advanceDays", () => {
  it("returns [] when date is more than advanceDays ahead of now", () => {
    const result = generateSlots({
      openingHour,
      settings: { ...baseSettings, advanceDays: 30 },
      date: calendarDate(2026, 9, 1), // 31 days after Aug 1
      now: bkk(2026, 8, 1, 0, 0),
      isClosureDay: false,
      bookedMap: {},
    });
    expect(result).toEqual([]);
  });

  it("allows the date exactly at the advanceDays boundary", () => {
    const result = generateSlots({
      openingHour,
      settings: { ...baseSettings, advanceDays: 30 },
      date: calendarDate(2026, 8, 31), // exactly 30 days after Aug 1
      now: bkk(2026, 8, 1, 0, 0),
      isClosureDay: false,
      bookedMap: {},
    });
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("rule 6: date is in the past", () => {
  it("returns [] when the date is before today (Bangkok)", () => {
    const result = generateSlots({
      openingHour,
      settings: baseSettings,
      date: calendarDate(2026, 8, 19),
      now: bkk(2026, 8, 20, 12, 0),
      isClosureDay: false,
      bookedMap: {},
    });
    expect(result).toEqual([]);
  });

  it("does not treat today itself as past", () => {
    const result = generateSlots({
      openingHour: { openTime: "10:00", closeTime: "22:00", isClosed: false },
      settings: baseSettings,
      date: calendarDate(2026, 8, 20),
      now: bkk(2026, 8, 20, 8, 0), // early morning, same day, before opening
      isClosureDay: false,
      bookedMap: {},
    });
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("rule 7: opening hours crossing midnight", () => {
  const crossingOpeningHour = { openTime: "18:00", closeTime: "02:00", isClosed: false };

  it("continues the slot sequence past midnight as next-day clock time", () => {
    const result = generateSlots({
      openingHour: crossingOpeningHour,
      settings: baseSettings,
      date: calendarDate(2026, 8, 20),
      now: farPastNow,
      isClosureDay: false,
      bookedMap: {},
    });
    expect(result.map((s) => s.time)).toEqual([
      "18:00", "19:00", "20:00", "21:00", "22:00", "23:00", "00:00", "01:00",
    ]);
  });

  it("ties after-midnight slots to real instants on the following calendar day", () => {
    // `now` is the real instant of the 00:00 slot (midnight going into Aug
    // 21). That slot should already be cut, but 01:00 — one real hour
    // later — should survive. Proves it resolves to a genuine later
    // instant, not just a label that happens to sort before "18:00".
    const result = generateSlots({
      openingHour: crossingOpeningHour,
      settings: { ...baseSettings, minLeadHours: 0 },
      date: calendarDate(2026, 8, 20),
      now: bangkokWallTimeToInstant(calendarDate(2026, 8, 20), 24 * 60),
      isClosureDay: false,
      bookedMap: {},
    });
    expect(result.map((s) => s.time)).toEqual(["01:00"]);
  });
});

describe("rule 8: available = max(0, capacity - booked)", () => {
  it("never goes negative when overbooked", () => {
    const result = generateSlots({
      openingHour: { openTime: "10:00", closeTime: "12:00", isClosed: false },
      settings: { ...baseSettings, capacityPerSlot: 4 },
      date: calendarDate(2026, 8, 20),
      now: farPastNow,
      isClosureDay: false,
      bookedMap: { "10:00": 7 },
    });
    const slot = result.find((s) => s.time === "10:00")!;
    expect(slot.booked).toBe(7);
    expect(slot.available).toBe(0);
  });

  it("shows available = 0 but keeps the slot when capacity is filled exactly", () => {
    const result = generateSlots({
      openingHour: { openTime: "10:00", closeTime: "12:00", isClosed: false },
      settings: { ...baseSettings, capacityPerSlot: 4 },
      date: calendarDate(2026, 8, 20),
      now: farPastNow,
      isClosureDay: false,
      bookedMap: { "10:00": 4 },
    });
    const slot = result.find((s) => s.time === "10:00");
    expect(slot).toBeDefined();
    expect(slot!.available).toBe(0);
  });
});

describe("edge case: slotDuration does not evenly divide the opening window", () => {
  it("10:00-21:30 at 60min drops the trailing 30min, last slot 20:00", () => {
    const result = generateSlots({
      openingHour: { openTime: "10:00", closeTime: "21:30", isClosed: false },
      settings: baseSettings,
      date: calendarDate(2026, 8, 20),
      now: farPastNow,
      isClosureDay: false,
      bookedMap: {},
    });
    expect(result).toHaveLength(11);
    expect(result[result.length - 1].time).toBe("20:00");
  });
});

describe("edge case: bookedMap has a key matching no generated slot", () => {
  it("is ignored, doesn't throw, doesn't affect other slots", () => {
    const call = () =>
      generateSlots({
        openingHour: { openTime: "10:00", closeTime: "12:00", isClosed: false },
        settings: baseSettings,
        date: calendarDate(2026, 8, 20),
        now: farPastNow,
        isClosureDay: false,
        bookedMap: { "23:59": 99, "not-a-time": 5 },
      });

    expect(call).not.toThrow();
    expect(call().every((s) => s.booked === 0)).toBe(true);
  });
});

describe("edge case: now falls exactly in the middle of the opening window", () => {
  it("splits slots into passed vs upcoming around now", () => {
    const result = generateSlots({
      openingHour: { openTime: "09:00", closeTime: "17:00", isClosed: false },
      settings: { ...baseSettings, minLeadHours: 0 },
      date: calendarDate(2026, 8, 20),
      now: bkk(2026, 8, 20, 13, 0),
      isClosureDay: false,
      bookedMap: {},
    });
    expect(result.map((s) => s.time)).toEqual(["14:00", "15:00", "16:00"]);
  });
});

describe("guard: non-positive slotDuration must never hang", () => {
  it("returns [] for slotDuration = 0 instead of looping forever", () => {
    const result = generateSlots({
      openingHour,
      settings: { ...baseSettings, slotDuration: 0 },
      date: calendarDate(2026, 8, 20),
      now: farPastNow,
      isClosureDay: false,
      bookedMap: {},
    });
    expect(result).toEqual([]);
  });

  it("returns [] for a negative slotDuration instead of looping forever", () => {
    const result = generateSlots({
      openingHour,
      settings: { ...baseSettings, slotDuration: -30 },
      date: calendarDate(2026, 8, 20),
      now: farPastNow,
      isClosureDay: false,
      bookedMap: {},
    });
    expect(result).toEqual([]);
  });
});

describe("combined: crossing midnight + other rules together", () => {
  const crossingOpeningHour = { openTime: "18:00", closeTime: "02:00", isClosed: false };

  it("3.1 — bookedMap keyed after midnight applies to the right slot", () => {
    const result = generateSlots({
      openingHour: crossingOpeningHour,
      settings: { ...baseSettings, capacityPerSlot: 4 },
      date: calendarDate(2026, 8, 20),
      now: farPastNow,
      isClosureDay: false,
      bookedMap: { "01:00": 3 },
    });
    const slot = result.find((s) => s.time === "01:00");
    expect(slot).toBeDefined();
    expect(slot!.booked).toBe(3);
    expect(slot!.available).toBe(1);
  });

  it("3.2 — now already past midnight (daysAhead = -1) leaves only the still-future overflow slot", () => {
    const result = generateSlots({
      openingHour: crossingOpeningHour,
      settings: { ...baseSettings, minLeadHours: 0 },
      date: calendarDate(2026, 8, 20),
      now: bkk(2026, 8, 21, 0, 30), // 00:30 the next day — 18:00-23:00 and 00:00 have all passed
      isClosureDay: false,
      bookedMap: {},
    });
    expect(result.map((s) => s.time)).toEqual(["01:00"]);
  });

  it("3.3 — minLeadHours applied across the midnight boundary", () => {
    const result = generateSlots({
      openingHour: crossingOpeningHour,
      settings: { ...baseSettings, minLeadHours: 2 },
      date: calendarDate(2026, 8, 20),
      now: bkk(2026, 8, 20, 22, 0),
      isClosureDay: false,
      bookedMap: {},
    });
    expect(result.map((s) => s.time)).toEqual(["00:00", "01:00"]);
  });
});

describe("resolveSlotStartMinutes / computeSlotInstant: recovering a stored slotTime's real instant", () => {
  const crossingOpeningHour = { openTime: "18:00", closeTime: "02:00" };
  const nonCrossingOpeningHour = { openTime: "10:00", closeTime: "21:00" };

  it("returns the literal minutes for a non-crossing window", () => {
    expect(resolveSlotStartMinutes(nonCrossingOpeningHour, "12:00")).toBe(12 * 60);
  });

  it("returns the literal (pre-midnight) minutes for a crossing window's before-midnight slots", () => {
    expect(resolveSlotStartMinutes(crossingOpeningHour, "18:00")).toBe(18 * 60);
    expect(resolveSlotStartMinutes(crossingOpeningHour, "23:00")).toBe(23 * 60);
  });

  it("adds 24h back for a crossing window's wrapped after-midnight slots", () => {
    expect(resolveSlotStartMinutes(crossingOpeningHour, "00:00")).toBe(24 * 60);
    expect(resolveSlotStartMinutes(crossingOpeningHour, "01:00")).toBe(25 * 60);
  });

  it("computeSlotInstant ties a wrapped '01:00' to the *following* calendar day's real instant, not the same day's 01:00", () => {
    const date = calendarDate(2026, 8, 20);
    const instant = computeSlotInstant(date, crossingOpeningHour, "01:00");

    expect(instant.getTime()).toBe(bangkokWallTimeToInstant(date, 25 * 60).getTime());
    expect(instant.getTime()).not.toBe(bangkokWallTimeToInstant(date, 1 * 60).getTime());
  });

  it("round-trips exactly against every slot generateSlots actually produces for a crossing window", () => {
    const date = calendarDate(2026, 8, 20);
    const slots = generateSlots({
      openingHour: { ...crossingOpeningHour, isClosed: false },
      settings: baseSettings,
      date,
      now: farPastNow,
      isClosureDay: false,
      bookedMap: {},
    });

    for (const slot of slots) {
      const recovered = resolveSlotStartMinutes(crossingOpeningHour, slot.time);
      const direct = bangkokWallTimeToInstant(date, recovered);
      // generateSlots itself computed each slot from an unwrapped `start` —
      // this confirms resolveSlotStartMinutes recovers that exact value
      // back from the wrapped display string alone.
      expect(direct.getTime()).toBe(computeSlotInstant(date, crossingOpeningHour, slot.time).getTime());
    }
  });
});

describe("resolveSlotBookability: re-checking a fetched slot against the current moment and party size", () => {
  const now = bkk(2026, 8, 20, 12, 0);
  const futureInstant = bkk(2026, 8, 20, 19, 0);
  const pastInstant = bkk(2026, 8, 20, 10, 0);

  it("bookable when the slot has enough seats and hasn't started yet", () => {
    const slot = { time: "19:00", capacity: 10, booked: 8, available: 2 };
    expect(resolveSlotBookability(slot, 2, futureInstant, now)).toEqual({ bookable: true });
  });

  it("unbookable (full) when available is exactly 0, regardless of party size", () => {
    const slot = { time: "19:00", capacity: 10, booked: 10, available: 0 };
    expect(resolveSlotBookability(slot, 1, futureInstant, now)).toEqual({
      bookable: false,
      reason: "full",
    });
  });

  // This is the exact scenario reported as a bug: a slot with 2 seats left
  // (not full — available > 0) selected for a party of 10. available===0
  // alone is not enough to catch this; the party size must be checked too.
  it("unbookable (insufficient_party_size) when available > 0 but less than the requested party size", () => {
    const slot = { time: "19:00", capacity: 10, booked: 8, available: 2 };
    expect(resolveSlotBookability(slot, 10, futureInstant, now)).toEqual({
      bookable: false,
      reason: "insufficient_party_size",
    });
  });

  it("unbookable (past) once the slot's real instant is no longer in the future, even with seats free", () => {
    const slot = { time: "10:00", capacity: 10, booked: 0, available: 10 };
    expect(resolveSlotBookability(slot, 2, pastInstant, now)).toEqual({
      bookable: false,
      reason: "past",
    });
  });

  it("past takes priority over full when both apply", () => {
    const slot = { time: "10:00", capacity: 10, booked: 10, available: 0 };
    expect(resolveSlotBookability(slot, 2, pastInstant, now)).toEqual({
      bookable: false,
      reason: "past",
    });
  });

  it("boundary: available exactly equal to party size is bookable (not 'insufficient')", () => {
    const slot = { time: "19:00", capacity: 10, booked: 8, available: 2 };
    expect(resolveSlotBookability(slot, 2, futureInstant, now)).toEqual({ bookable: true });
  });
});

describe("isOpenNow: open/closed-now badge for a restaurant list card", () => {
  const openRow = (openTime: string, closeTime: string) => ({ openTime, closeTime, isClosed: false });
  const closedRow = { openTime: "00:00", closeTime: "00:00", isClosed: true };

  it("open during today's own (non-crossing) hours", () => {
    const today = openRow("10:00", "22:00");
    const yesterday = closedRow;
    expect(isOpenNow(today, yesterday, bkk(2026, 8, 20, 15, 0))).toBe(true);
  });

  it("closed before today's opening time and after today's closing time", () => {
    const today = openRow("10:00", "22:00");
    const yesterday = closedRow;
    expect(isOpenNow(today, yesterday, bkk(2026, 8, 20, 9, 0))).toBe(false);
    expect(isOpenNow(today, yesterday, bkk(2026, 8, 20, 22, 30))).toBe(false);
  });

  it("open right at the opening minute, closed right at the closing minute (half-open interval)", () => {
    const today = openRow("10:00", "22:00");
    const yesterday = closedRow;
    expect(isOpenNow(today, yesterday, bkk(2026, 8, 20, 10, 0))).toBe(true);
    expect(isOpenNow(today, yesterday, bkk(2026, 8, 20, 22, 0))).toBe(false);
  });

  it("closed when today's row is isClosed, even inside what would be its hours", () => {
    const today = { openTime: "10:00", closeTime: "22:00", isClosed: true };
    const yesterday = closedRow;
    expect(isOpenNow(today, yesterday, bkk(2026, 8, 20, 15, 0))).toBe(false);
  });

  // The exact scenario the badge exists for: restaurant 2 in scripts/seed-demo.ts,
  // open 18:00-02:00. At 01:00 the *next* calendar day, todayRow's own hours
  // haven't started yet (opens 18:00) — only yesterday's overnight window
  // still covers it.
  it("open via yesterday's overnight window crossing into today, before today's own hours start", () => {
    const today = openRow("18:00", "02:00");
    const yesterday = openRow("18:00", "02:00");
    expect(isOpenNow(today, yesterday, bkk(2026, 8, 20, 1, 0))).toBe(true);
  });

  it("closed in the gap after yesterday's overnight window ends and before today's own hours start", () => {
    const today = openRow("18:00", "02:00");
    const yesterday = openRow("18:00", "02:00");
    // Gap is 02:00-18:00.
    expect(isOpenNow(today, yesterday, bkk(2026, 8, 20, 10, 0))).toBe(false);
  });

  it("open via today's own crossing window in the evening portion", () => {
    const today = openRow("18:00", "02:00");
    const yesterday = openRow("18:00", "02:00");
    expect(isOpenNow(today, yesterday, bkk(2026, 8, 20, 20, 0))).toBe(true);
  });

  it("not open via yesterday's window when yesterday was closed, even if today's own hours haven't started", () => {
    const today = openRow("18:00", "02:00");
    const yesterday = closedRow;
    expect(isOpenNow(today, yesterday, bkk(2026, 8, 20, 1, 0))).toBe(false);
  });
});
