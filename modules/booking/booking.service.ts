import "server-only";

import { randomInt } from "node:crypto";
import { BookingStatus, RestaurantStatus, Prisma, type Booking } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ERROR_CODES, type ErrorCode } from "@/lib/api-response";
import { MESSAGES } from "@/constants/messages";
import type { Profile } from "@/lib/dal";
import { parseCalendarDateString, calendarDayOfWeek } from "@/lib/datetime";
import * as restaurantService from "@/modules/restaurant/restaurant.service";
import { generateSlots, type Slot } from "./slot.engine";
import { SEAT_CONSUMING_STATUSES } from "./booking.state";

type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: ErrorCode; message: string } };

export type SlotContext = {
  openingHour: { openTime: string; closeTime: string; isClosed: boolean };
  isClosureDay: boolean;
  settings: {
    slotDuration: number;
    capacityPerSlot: number;
    minLeadHours: number;
    advanceDays: number;
    maxPartySize: number;
    autoConfirm: boolean;
  };
  bookedMap: Record<string, number>;
};

/**
 * Gathers everything generateSlots needs, in one round trip. Takes a Prisma
 * client rather than reaching for the module-level singleton, so Task 5's
 * createBooking can pass its transaction client (`tx`) here to re-check
 * availability against the same in-flight transaction right before
 * inserting a booking, instead of a separate (and racy) query.
 */
export async function loadSlotContext(
  db: Prisma.TransactionClient,
  restaurantId: string,
  date: Date
): Promise<SlotContext | null> {
  const dayOfWeek = calendarDayOfWeek(date);

  const [openingHourRow, closure, bookingSettings, bookedGroups] = await Promise.all([
    db.openingHour.findUnique({ where: { restaurantId_dayOfWeek: { restaurantId, dayOfWeek } } }),
    db.closure.findUnique({ where: { restaurantId_closedDate: { restaurantId, closedDate: date } } }),
    db.bookingSetting.findUnique({ where: { restaurantId } }),
    db.booking.groupBy({
      by: ["slotTime"],
      where: { restaurantId, bookingDate: date, status: { in: SEAT_CONSUMING_STATUSES } },
      _sum: { partySize: true },
    }),
  ]);

  // Every restaurant gets its booking_settings row at creation (Task 3) —
  // missing here means the restaurant itself doesn't exist in a bookable
  // state, not a normal "no data yet" case.
  if (!bookingSettings) {
    return null;
  }

  const bookedMap: Record<string, number> = {};
  for (const row of bookedGroups) {
    bookedMap[row.slotTime] = row._sum.partySize ?? 0;
  }

  return {
    // No OpeningHour row for this day of week (shouldn't happen — Task 3
    // seeds all 7 — but defensively treated as closed rather than crashing).
    openingHour: openingHourRow ?? { openTime: "00:00", closeTime: "00:00", isClosed: true },
    isClosureDay: closure !== null,
    settings: {
      slotDuration: bookingSettings.slotDuration,
      capacityPerSlot: bookingSettings.capacityPerSlot,
      minLeadHours: bookingSettings.minLeadHours,
      advanceDays: bookingSettings.advanceDays,
      maxPartySize: bookingSettings.maxPartySize,
      autoConfirm: bookingSettings.autoConfirm,
    },
    bookedMap,
  };
}

export async function getAvailableSlots(
  restaurantId: string,
  dateString: string,
  viewer: Profile | null
): Promise<ServiceResult<Slot[]>> {
  const date = parseCalendarDateString(dateString);
  if (!date) {
    return {
      success: false,
      error: { code: ERROR_CODES.VALIDATION_ERROR, message: MESSAGES.booking.invalidDateFormat },
    };
  }

  // Same visibility rule as a restaurant detail page: approved -> everyone,
  // owner -> their own restaurant regardless of status, admin -> all,
  // everyone else gets NOT_FOUND (existence of a pending/rejected/suspended
  // restaurant isn't leaked).
  const restaurant = await restaurantService.getRestaurantById(restaurantId, viewer);
  if (!restaurant) {
    return {
      success: false,
      error: { code: ERROR_CODES.NOT_FOUND, message: MESSAGES.restaurant.notFound },
    };
  }

  const context = await loadSlotContext(prisma, restaurantId, date);
  if (!context) {
    return {
      success: false,
      error: { code: ERROR_CODES.NOT_FOUND, message: MESSAGES.booking.settingsMissing },
    };
  }

  const slots = generateSlots({
    openingHour: context.openingHour,
    settings: context.settings,
    date,
    now: new Date(),
    isClosureDay: context.isClosureDay,
    bookedMap: context.bookedMap,
  });

  return { success: true, data: slots };
}

// A-Z0-9 minus 0/O/1/I/L — visually confusable pairs a customer reading the
// code aloud (or off a printed receipt) could easily swap. 31 characters
// (not the tidier-sounding 32; five symbols come out of 36, not four).
const BOOKING_CODE_CHARS = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const BOOKING_CODE_LENGTH = 6;
const MAX_CREATE_BOOKING_ATTEMPTS = 5;

function generateBookingCode(): string {
  let code = "";
  for (let i = 0; i < BOOKING_CODE_LENGTH; i++) {
    code += BOOKING_CODE_CHARS[randomInt(BOOKING_CODE_CHARS.length)];
  }
  return `BK-${code}`;
}

function isBookingCodeCollision(err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") {
    return false;
  }
  const target = err.meta?.target;
  return Array.isArray(target) ? target.includes("code") : typeof target === "string" && target.includes("code");
}

// Thrown only for business-rule failures inside createBooking's transaction
// (never for the code-collision case — that's a plain Prisma P2002, caught
// separately so it can be retried instead of surfaced as this restaurant's
// final answer).
class BookingValidationError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string
  ) {
    super(message);
  }
}

export type CreateBookingInput = {
  restaurantId: string;
  date: string; // "YYYY-MM-DD"
  slotTime: string; // "HH:MM", must match a time generateSlots would produce
  partySize: number;
  customerNote?: string;
};

/**
 * customerId must come from the caller's session (e.g. requireProfileOrThrow
 * at the route), never from request input — a client-supplied customerId
 * would let anyone book on someone else's behalf.
 */
export async function createBooking(
  customerId: string,
  input: CreateBookingInput
): Promise<ServiceResult<Booking>> {
  const date = parseCalendarDateString(input.date);
  if (!date) {
    return {
      success: false,
      error: { code: ERROR_CODES.VALIDATION_ERROR, message: MESSAGES.booking.invalidDateFormat },
    };
  }

  // Keyed on (restaurant, date + slotTime) so unrelated slots — different
  // times, different days, different restaurants — never wait on each other.
  const lockKey = `${input.date}|${input.slotTime}`;

  for (let attempt = 1; attempt <= MAX_CREATE_BOOKING_ATTEMPTS; attempt++) {
    try {
      const booking = await prisma.$transaction(
        async (tx) => {
          // This project's DATABASE_URL goes through Supabase's PgBouncer in
          // transaction-pooling mode (see CLAUDE.md "ข้อจำกัดเวอร์ชัน"): each
          // *transaction*, not each session, can land on a different physical
          // Postgres connection. A plain pg_advisory_lock is session-scoped —
          // its matching unlock could be issued on a different physical
          // connection than the one that took the lock, and Postgres only
          // releases a session lock on the connection that acquired it. An
          // unmatched unlock then leaves the lock held forever (until that
          // connection is dropped), which would eventually wedge every slot
          // it ever guarded as permanently "full". pg_advisory_xact_lock has
          // no separate unlock call — it's released automatically at this
          // transaction's COMMIT/ROLLBACK on this same connection, so it
          // can't outlive the transaction that took it. Do not swap this for
          // pg_advisory_lock, and do not add FOR UPDATE on bookings below —
          // this lock already serializes every writer for this slot.
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.restaurantId}), hashtext(${lockKey}))`;

          const restaurant = await tx.restaurant.findUnique({ where: { id: input.restaurantId } });
          if (!restaurant) {
            throw new BookingValidationError(ERROR_CODES.NOT_FOUND, MESSAGES.restaurant.notFound);
          }
          if (restaurant.status !== RestaurantStatus.APPROVED) {
            throw new BookingValidationError(ERROR_CODES.INVALID_STATE, MESSAGES.booking.restaurantNotApproved);
          }

          const context = await loadSlotContext(tx, input.restaurantId, date);
          if (!context) {
            throw new BookingValidationError(ERROR_CODES.NOT_FOUND, MESSAGES.booking.settingsMissing);
          }

          const slots = generateSlots({
            openingHour: context.openingHour,
            settings: context.settings,
            date,
            now: new Date(),
            isClosureDay: context.isClosureDay,
            bookedMap: context.bookedMap,
          });
          const slot = slots.find((s) => s.time === input.slotTime);
          if (!slot) {
            throw new BookingValidationError(ERROR_CODES.VALIDATION_ERROR, MESSAGES.booking.slotNotAvailable);
          }

          if (!Number.isInteger(input.partySize) || input.partySize <= 0) {
            throw new BookingValidationError(ERROR_CODES.VALIDATION_ERROR, MESSAGES.booking.partySizeInvalid);
          }
          if (input.partySize > context.settings.maxPartySize) {
            throw new BookingValidationError(
              ERROR_CODES.VALIDATION_ERROR,
              MESSAGES.booking.partySizeExceedsMax(context.settings.maxPartySize)
            );
          }

          if (slot.available < input.partySize) {
            throw new BookingValidationError(ERROR_CODES.SLOT_FULL, MESSAGES.booking.slotFull);
          }

          return tx.booking.create({
            data: {
              restaurantId: input.restaurantId,
              customerId,
              bookingDate: date,
              slotTime: input.slotTime,
              partySize: input.partySize,
              code: generateBookingCode(),
              customerNote: input.customerNote,
              status: context.settings.autoConfirm ? BookingStatus.CONFIRMED : BookingStatus.PENDING,
            },
          });
        },
        // Generous headroom, not a normal-path budget: under lock contention
        // a request can be the last of several queued on the same slot, each
        // waiting out the ones ahead of it inside this same transaction.
        { timeout: 20_000, maxWait: 20_000 }
      );

      return { success: true, data: booking };
    } catch (err) {
      if (err instanceof BookingValidationError) {
        return { success: false, error: { code: err.code, message: err.message } };
      }

      if (isBookingCodeCollision(err)) {
        if (attempt === MAX_CREATE_BOOKING_ATTEMPTS) {
          console.error(
            `[booking] createBooking: exhausted ${MAX_CREATE_BOOKING_ATTEMPTS} attempts on code collisions`,
            err
          );
          return {
            success: false,
            error: { code: ERROR_CODES.BOOKING_CODE_GENERATION_FAILED, message: MESSAGES.booking.codeGenerationFailed },
          };
        }
        continue;
      }

      console.error("[booking] createBooking: transaction failed", err);
      return {
        success: false,
        error: { code: ERROR_CODES.BOOKING_CREATE_FAILED, message: MESSAGES.booking.createFailed },
      };
    }
  }

  // Unreachable: every loop path above returns — the collision branch only
  // `continue`s while attempt < MAX_CREATE_BOOKING_ATTEMPTS, and returns on
  // the final attempt. Here only to satisfy TypeScript's return analysis.
  throw new Error("createBooking: retry loop exited without returning");
}
