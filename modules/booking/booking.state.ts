import { BookingStatus } from "@prisma/client";

// Explicit state machine, same shape as restaurant status's
// ALLOWED_TRANSITIONS (admin.service.ts, Task 3).
export const ALLOWED_BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  [BookingStatus.PENDING]: [BookingStatus.CONFIRMED, BookingStatus.REJECTED, BookingStatus.CANCELLED],
  [BookingStatus.CONFIRMED]: [BookingStatus.CHECKED_IN, BookingStatus.CANCELLED, BookingStatus.NO_SHOW],
  [BookingStatus.CHECKED_IN]: [BookingStatus.COMPLETED],
  [BookingStatus.COMPLETED]: [],
  [BookingStatus.REJECTED]: [],
  [BookingStatus.CANCELLED]: [],
  [BookingStatus.NO_SHOW]: [],
};

// Statuses that still hold a seat against capacity — the single source of
// truth for "counts toward capacity". Used by both loadSlotContext (Task 4)
// and createBooking (Task 5); never redeclare this list elsewhere.
export const SEAT_CONSUMING_STATUSES: BookingStatus[] = [
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
  BookingStatus.CHECKED_IN,
];
