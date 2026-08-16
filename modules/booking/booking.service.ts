import "server-only";

import { randomInt } from "node:crypto";
import { BookingStatus, RestaurantStatus, Prisma, type Booking } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ERROR_CODES, type ErrorCode } from "@/lib/api-response";
import { MESSAGES } from "@/constants/messages";
import type { Profile } from "@/lib/dal";
import { parseCalendarDateString, formatCalendarDateString, calendarDayOfWeek } from "@/lib/datetime";
import { BOOKING_STATUS_LABELS_TH } from "@/constants/messages";
import * as restaurantService from "@/modules/restaurant/restaurant.service";
import { generateSlots, computeSlotInstant, type Slot } from "./slot.engine";
import {
  SEAT_CONSUMING_STATUSES,
  ALLOWED_BOOKING_TRANSITIONS,
  CUSTOMER_ALLOWED_TARGET_STATUSES,
  OWNER_ALLOWED_TARGET_STATUSES,
} from "./booking.state";

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

// Shared by createBooking and changeBookingStatus — both must derive the
// exact same key for the exact same slot, or the lock stops meaning
// anything. dateString must already be canonical "YYYY-MM-DD" (see the
// warning above bookingLockKey's two call sites).
function bookingLockKey(dateString: string, slotTime: string): string {
  return `${dateString}|${slotTime}`;
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
  const lockKey = bookingLockKey(input.date, input.slotTime);

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

/**
 * actor must come from the caller's session (e.g. requireProfileOrThrow /
 * requireRoleOrThrow at the route) — never trust a role or id sent by the
 * client, same reasoning as createBooking's customerId.
 */
export async function changeBookingStatus(
  bookingId: string,
  actor: Profile,
  nextStatus: BookingStatus,
  reason?: string
): Promise<ServiceResult<Booking>> {

  try {
    const booking = await prisma.$transaction(
      async (tx) => {
        // bookingDate/slotTime/restaurantId never change after creation —
        // safe to read before the lock, purely to compute its key.
        const initial = await tx.booking.findUnique({ where: { id: bookingId } });
        if (!initial) {
          throw new BookingValidationError(ERROR_CODES.NOT_FOUND, MESSAGES.booking.notFound);
        }

        // Same key createBooking uses for this exact slot (see the comment
        // on that lock — pg_advisory_xact_lock, 2-key, no FOR UPDATE on
        // bookings below it) — a cancel and a competing create for the same
        // slot must serialize against each other, or a cancel that frees a
        // seat and a create that consumes one can both read the old count
        // and both decide they're allowed to proceed.
        const lockKey = bookingLockKey(formatCalendarDateString(initial.bookingDate), initial.slotTime);
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${initial.restaurantId}), hashtext(${lockKey}))`;

        // Re-read after the lock: `initial` may now be stale — another
        // transaction queued behind this one on the same key could have
        // committed a status change while this one was waiting.
        const booking = await tx.booking.findUnique({ where: { id: bookingId } });
        if (!booking) {
          throw new BookingValidationError(ERROR_CODES.NOT_FOUND, MESSAGES.booking.notFound);
        }

        // 1) & 2) combined: what this *actor* may target on *this specific
        // booking* is decided by their real relationship to it — never by
        // actor.role alone. role is monotonic in this system (customer ->
        // owner is permanent, Task 3) and is only a *system*-level grant
        // (admin); it says nothing about whether this particular booking
        // belongs to this particular actor. Fetched unconditionally since
        // isRestaurantOwner needs it regardless of role, and so does the
        // minLeadHours check below.
        const restaurant = await tx.restaurant.findUnique({ where: { id: booking.restaurantId } });
        const isBookingOwner = booking.customerId === actor.id;
        const isRestaurantOwner = restaurant?.ownerId === actor.id;
        const isAdmin = actor.role === "admin";

        // Union, not if/else-if: the same person can be both (booking their
        // own restaurant) and must get both permission sets, not just one.
        const allowedTargets = new Set<BookingStatus>();
        if (isBookingOwner) {
          for (const status of CUSTOMER_ALLOWED_TARGET_STATUSES) allowedTargets.add(status);
        }
        if (isRestaurantOwner) {
          for (const status of OWNER_ALLOWED_TARGET_STATUSES) allowedTargets.add(status);
        }

        if (!isAdmin && !allowedTargets.has(nextStatus)) {
          throw new BookingValidationError(ERROR_CODES.FORBIDDEN, MESSAGES.booking.forbidden);
        }

        // 3) Is this transition legal at all, from the booking's current status?
        const allowedFromCurrent = ALLOWED_BOOKING_TRANSITIONS[booking.status];
        if (!allowedFromCurrent.includes(nextStatus)) {
          throw new BookingValidationError(
            ERROR_CODES.INVALID_STATE,
            MESSAGES.booking.invalidTransition(
              BOOKING_STATUS_LABELS_TH[booking.status],
              allowedFromCurrent.map((status) => BOOKING_STATUS_LABELS_TH[status])
            )
          );
        }

        // 4) CANCELLED initiated by the *restaurant owner*, on a booking
        // that isn't their own (cancelling a customer's booking on their
        // behalf — e.g. a phone call), must record why: unlike a
        // self-cancel, there's otherwise no record of who made this call or
        // what the customer actually said.
        //
        // `!isBookingOwner` matters here: an owner who booked at their own
        // restaurant is *both* isRestaurantOwner and isBookingOwner, and
        // cancelling their own booking there is still a self-cancel (same
        // "union of permission sets" reasoning as everywhere else in this
        // function) — it shouldn't suddenly demand a reason just because
        // they also happen to own the restaurant.
        //
        // Gated on isRestaurantOwner specifically, not "not the customer"
        // generally — admin already has its own unrestricted operational
        // path through every status (no relationship check at all, see 1&2
        // above) and wasn't asked to be held to this reason requirement
        // too, so an admin-initiated CANCELLED stays exactly as permissive
        // as every other admin-initiated transition. A genuine self-cancel
        // (by the booking's own customer) keeps its reason optional,
        // unchanged from before.
        if (isRestaurantOwner && !isBookingOwner && nextStatus === BookingStatus.CANCELLED && !reason?.trim()) {
          throw new BookingValidationError(ERROR_CODES.VALIDATION_ERROR, MESSAGES.booking.cancelReasonRequired);
        }

        // 5) Self-cancel (by whoever the booking actually belongs to) has
        // its own deadline: must be at least minLeadHours before the slot.
        // Owner/admin-initiated changes (reject, no-show, cancelling on the
        // customer's behalf, etc.) are operational actions at or after the
        // booking time and aren't subject to this — gated on isBookingOwner
        // specifically, never on role, so it doesn't accidentally apply to
        // an owner cancelling someone else's booking.
        if (isBookingOwner && nextStatus === BookingStatus.CANCELLED) {
          const [bookingSetting, openingHourRow] = await Promise.all([
            tx.bookingSetting.findUnique({ where: { restaurantId: booking.restaurantId } }),
            tx.openingHour.findUnique({
              where: {
                restaurantId_dayOfWeek: {
                  restaurantId: booking.restaurantId,
                  dayOfWeek: calendarDayOfWeek(booking.bookingDate),
                },
              },
            }),
          ]);
          const minLeadHours = bookingSetting?.minLeadHours ?? 0;
          // computeSlotInstant (slot.engine.ts) unwraps a cross-midnight
          // slot's stored "HH:MM" back to its real instant the same way
          // generateSlots itself computed it — never re-derive this here.
          // No OpeningHour row for this day of week shouldn't happen (Task
          // 3 seeds all 7) but falls back to treating slotTime literally
          // rather than crashing this check, same defensive default
          // loadSlotContext uses.
          const openingHour = openingHourRow ?? { openTime: "00:00", closeTime: "00:00" };
          const slotInstant = computeSlotInstant(booking.bookingDate, openingHour, booking.slotTime);
          if (slotInstant.getTime() - Date.now() < minLeadHours * 60 * 60_000) {
            throw new BookingValidationError(ERROR_CODES.INVALID_STATE, MESSAGES.booking.cancelDeadlinePassed);
          }
        }

        // REJECTED/CANCELLED only, and only when a reason was actually
        // given — never cleared by a later transition (same rule as
        // Restaurant.rejectReason, Task 3), so omit the field entirely
        // rather than writing null when there's nothing to say.
        const shouldStoreReason =
          reason?.trim() && (nextStatus === BookingStatus.REJECTED || nextStatus === BookingStatus.CANCELLED);

        return tx.booking.update({
          where: { id: bookingId },
          data: { status: nextStatus, ...(shouldStoreReason ? { statusReason: reason!.trim() } : {}) },
        });
      },
      // Same reasoning as createBooking: a cancel/status-change can queue
      // behind other writers on the same slot's advisory lock.
      { timeout: 20_000, maxWait: 20_000 }
    );

    return { success: true, data: booking };
  } catch (err) {
    if (err instanceof BookingValidationError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    console.error("[booking] changeBookingStatus: transaction failed", err);
    return {
      success: false,
      error: { code: ERROR_CODES.BOOKING_STATUS_UPDATE_FAILED, message: MESSAGES.booking.statusUpdateFailed },
    };
  }
}

const UPCOMING_BOOKING_STATUSES = [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN];
const HISTORY_BOOKING_STATUSES = [BookingStatus.COMPLETED, BookingStatus.NO_SHOW];
const CANCELLED_BOOKING_STATUSES = [BookingStatus.CANCELLED, BookingStatus.REJECTED];

export type GetMyBookingsFilter = {
  page?: number;
  pageSize?: number;
};

// The shape each Booking row comes back in from getMyBookings — enough for
// /bookings/my and /dashboard to render a card (restaurant name) and to
// decide client-side whether "cancel" should even be tappable (opening
// hours + minLeadHours, same inputs changeBookingStatus itself uses for the
// real deadline check server-side).
const MY_BOOKINGS_INCLUDE = {
  restaurant: {
    select: {
      id: true,
      name: true,
      openingHours: { select: { dayOfWeek: true, openTime: true, closeTime: true, isClosed: true } },
      bookingSetting: { select: { minLeadHours: true } },
    },
  },
} satisfies Prisma.BookingInclude;

export type MyBooking = Prisma.BookingGetPayload<{ include: typeof MY_BOOKINGS_INCLUDE }>;

export type MyBookings = {
  upcoming: MyBooking[];
  history: MyBooking[];
  cancelled: MyBooking[];
};

/**
 * The 3 buckets exactly partition all 7 BookingStatus values once each:
 * upcoming = still active (not yet resolved), history = the slot happened
 * (completed or a no-show), cancelled = didn't happen because someone
 * called it off (customer-cancelled or owner-rejected).
 */
export async function getMyBookings(customerId: string, filter: GetMyBookingsFilter = {}): Promise<MyBookings> {
  const page = filter.page ?? 1;
  const pageSize = filter.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const [upcoming, history, cancelled] = await Promise.all([
    prisma.booking.findMany({
      where: { customerId, status: { in: UPCOMING_BOOKING_STATUSES } },
      include: MY_BOOKINGS_INCLUDE,
      orderBy: [{ bookingDate: "asc" }, { slotTime: "asc" }],
      skip,
      take: pageSize,
    }),
    prisma.booking.findMany({
      where: { customerId, status: { in: HISTORY_BOOKING_STATUSES } },
      include: MY_BOOKINGS_INCLUDE,
      orderBy: [{ bookingDate: "desc" }, { slotTime: "desc" }],
      skip,
      take: pageSize,
    }),
    prisma.booking.findMany({
      where: { customerId, status: { in: CANCELLED_BOOKING_STATUSES } },
      include: MY_BOOKINGS_INCLUDE,
      orderBy: [{ bookingDate: "desc" }, { slotTime: "desc" }],
      skip,
      take: pageSize,
    }),
  ]);

  return { upcoming, history, cancelled };
}

// /owner/dashboard (Task 7 phase 2) needs the customer's name/phone on each
// row, which the plain Booking row doesn't carry (Booking only has
// customerId) — same reasoning as MY_BOOKINGS_INCLUDE above, just the
// other side of the relation.
const RESTAURANT_BOOKINGS_INCLUDE = {
  customer: { select: { id: true, fullName: true, phone: true, email: true } },
} satisfies Prisma.BookingInclude;

export type RestaurantBooking = Prisma.BookingGetPayload<{ include: typeof RESTAURANT_BOOKINGS_INCLUDE }>;

export async function getRestaurantBookings(
  restaurantId: string,
  ownerId: string,
  date?: string
): Promise<ServiceResult<RestaurantBooking[]>> {
  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
  if (!restaurant) {
    return { success: false, error: { code: ERROR_CODES.NOT_FOUND, message: MESSAGES.restaurant.notFound } };
  }
  if (restaurant.ownerId !== ownerId) {
    return { success: false, error: { code: ERROR_CODES.FORBIDDEN, message: MESSAGES.restaurant.forbidden } };
  }

  let bookingDate: Date | undefined;
  if (date !== undefined) {
    const parsed = parseCalendarDateString(date);
    if (!parsed) {
      return {
        success: false,
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: MESSAGES.booking.invalidDateFormat },
      };
    }
    bookingDate = parsed;
  }

  const bookings = await prisma.booking.findMany({
    where: { restaurantId, ...(bookingDate ? { bookingDate } : {}) },
    include: RESTAURANT_BOOKINGS_INCLUDE,
    orderBy: { slotTime: "asc" },
  });

  return { success: true, data: bookings };
}
