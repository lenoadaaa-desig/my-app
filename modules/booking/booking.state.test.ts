import { describe, it, expect } from "vitest";
import { BookingStatus } from "@prisma/client";
import { ALLOWED_BOOKING_TRANSITIONS, SEAT_CONSUMING_STATUSES } from "./booking.state";

const ALL_STATUSES = Object.values(BookingStatus);

const EXPECTED_ALLOWED: Record<BookingStatus, BookingStatus[]> = {
  PENDING: ["CONFIRMED", "REJECTED", "CANCELLED"],
  CONFIRMED: ["CHECKED_IN", "CANCELLED", "NO_SHOW"],
  CHECKED_IN: ["COMPLETED"],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

describe("ALLOWED_BOOKING_TRANSITIONS", () => {
  it("declares every BookingStatus as a key", () => {
    expect(Object.keys(ALLOWED_BOOKING_TRANSITIONS).sort()).toEqual(ALL_STATUSES.sort());
  });

  for (const from of ALL_STATUSES) {
    describe(`from ${from}`, () => {
      const allowed = EXPECTED_ALLOWED[from];
      const disallowed = ALL_STATUSES.filter((s) => !allowed.includes(s));

      for (const to of allowed) {
        it(`allows -> ${to}`, () => {
          expect(ALLOWED_BOOKING_TRANSITIONS[from]).toContain(to);
        });
      }

      for (const to of disallowed) {
        it(`rejects -> ${to}`, () => {
          expect(ALLOWED_BOOKING_TRANSITIONS[from]).not.toContain(to);
        });
      }
    });
  }

  describe("terminal statuses have no outgoing transitions", () => {
    for (const status of ["COMPLETED", "REJECTED", "CANCELLED", "NO_SHOW"] as BookingStatus[]) {
      it(`${status} -> []`, () => {
        expect(ALLOWED_BOOKING_TRANSITIONS[status]).toEqual([]);
      });
    }
  });
});

describe("SEAT_CONSUMING_STATUSES", () => {
  it("is exactly PENDING, CONFIRMED, CHECKED_IN", () => {
    expect([...SEAT_CONSUMING_STATUSES].sort()).toEqual(
      [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN].sort()
    );
  });

  it("excludes every terminal status", () => {
    for (const status of ["COMPLETED", "REJECTED", "CANCELLED", "NO_SHOW"] as BookingStatus[]) {
      expect(SEAT_CONSUMING_STATUSES).not.toContain(status);
    }
  });
});
