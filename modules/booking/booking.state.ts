// Type-only import — erased at compile time. A Prisma enum member's actual
// runtime value is just its plain uppercase string (BookingStatus.PENDING
// === "PENDING"), so writing the literals directly below keeps this file
// free of any runtime dependency on @prisma/client's generated module,
// which pulls in Node-only internals unsafe to bundle for the browser.
// That matters here specifically because this file has no "server-only"
// guard on purpose — app/bookings/my/my-bookings-view.tsx (a client
// component) imports ALLOWED_BOOKING_TRANSITIONS directly to decide
// whether "cancel" should even be tappable, reusing the exact same rule
// modules/booking/booking.service.ts's changeBookingStatus enforces
// server-side, instead of re-guessing it client-side.
import type { BookingStatus } from "@prisma/client";

// Explicit state machine, same shape as restaurant status's
// ALLOWED_TRANSITIONS (admin.service.ts, Task 3).
export const ALLOWED_BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  PENDING: ["CONFIRMED", "REJECTED", "CANCELLED"],
  CONFIRMED: ["CHECKED_IN", "CANCELLED", "NO_SHOW"],
  CHECKED_IN: ["COMPLETED"],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

// Statuses that still hold a seat against capacity — the single source of
// truth for "counts toward capacity". Used by both loadSlotContext (Task 4)
// and createBooking (Task 5); never redeclare this list elsewhere.
export const SEAT_CONSUMING_STATUSES: BookingStatus[] = ["PENDING", "CONFIRMED", "CHECKED_IN"];

// Which *target* status each *relationship* to a booking grants, independent
// of ALLOWED_BOOKING_TRANSITIONS above (that graph governs whether the move
// is legal in the domain at all; this governs who's allowed to invoke it).
// Keyed by relationship (is this actor the booking's customer? the
// restaurant's owner?), never by actor.role — role is monotonic in this
// system (customer -> owner is permanent, Task 3) and is only a *system*-
// level grant (admin), not evidence of a relationship to any specific
// booking. changeBookingStatus computes both relationships per request and
// unions whichever of these apply — the same actor can hold both at once
// (booking their own restaurant). Admin has no entry here — it isn't
// restricted by relationship at all, only by the transition graph, so
// changeBookingStatus special-cases actor.role === "admin" as unrestricted
// rather than listing all 7 statuses here.
export const CUSTOMER_ALLOWED_TARGET_STATUSES: BookingStatus[] = ["CANCELLED"];

export const OWNER_ALLOWED_TARGET_STATUSES: BookingStatus[] = [
  "CONFIRMED",
  "REJECTED",
  "CHECKED_IN",
  "NO_SHOW",
  "COMPLETED",
];
