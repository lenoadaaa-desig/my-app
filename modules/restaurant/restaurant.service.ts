import "server-only";

import { cache } from "react";
import {
  Prisma,
  Role as PrismaRole,
  RestaurantStatus,
  type Restaurant,
  type BookingSetting,
  type OpeningHour,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ERROR_CODES, type ErrorCode } from "@/lib/api-response";
import { MESSAGES } from "@/constants/messages";
import type { Profile } from "@/lib/dal";
import * as authService from "@/modules/auth/auth.service";
import { ALLOWED_TRANSITIONS } from "@/modules/admin/admin.service";
import { SEAT_CONSUMING_STATUSES } from "@/modules/booking/booking.state";
import { calendarDayOfWeek, bangkokToday, formatCalendarDateString, timeStringToMinutes } from "@/lib/datetime";
import type {
  CreateRestaurantInput,
  UpdateRestaurantInput,
  ListPublicRestaurantsInput,
  OpeningHourInput,
  UpdateBookingSettingInput,
} from "./restaurant.schema";

type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: ErrorCode; message: string } };

// dayOfWeek follows Date.getDay(): 0 = Sunday ... 6 = Saturday.
const DEFAULT_OPENING_HOURS = Array.from({ length: 7 }, (_, dayOfWeek) => ({
  dayOfWeek,
  openTime: "10:00",
  closeTime: "22:00",
  isClosed: false,
}));

export async function createRestaurant(
  ownerId: string,
  data: CreateRestaurantInput
): Promise<ServiceResult<Restaurant>> {
  const profile = await prisma.profile.findUnique({ where: { id: ownerId } });
  if (!profile) {
    return {
      success: false,
      error: { code: ERROR_CODES.NOT_FOUND, message: MESSAGES.restaurant.notFound },
    };
  }

  // Admins approve restaurants — letting them also register one would let
  // an admin approve their own submission. Conflict of interest, blocked
  // outright rather than merely making self-approval hard.
  if (profile.role === PrismaRole.ADMIN) {
    return {
      success: false,
      error: { code: ERROR_CODES.FORBIDDEN, message: MESSAGES.restaurant.adminCannotCreate },
    };
  }

  let restaurant: Restaurant;
  try {
    restaurant = await prisma.$transaction(async (tx) => {
      const created = await tx.restaurant.create({
        data: {
          ownerId,
          name: data.name,
          description: data.description,
          address: data.address,
          phone: data.phone,
          category: data.category,
          coverImage: data.coverImage,
          status: RestaurantStatus.PENDING,
        },
      });

      await tx.openingHour.createMany({
        data: DEFAULT_OPENING_HOURS.map((hours) => ({
          restaurantId: created.id,
          ...hours,
        })),
      });

      await tx.bookingSetting.create({ data: { restaurantId: created.id } });

      return created;
    });
  } catch (err) {
    console.error("[restaurant] createRestaurant: transaction failed", err);
    return {
      success: false,
      error: { code: ERROR_CODES.RESTAURANT_CREATE_FAILED, message: MESSAGES.restaurant.createFailed },
    };
  }

  if (profile.role === PrismaRole.CUSTOMER) {
    // Outside the transaction: setUserRole also calls the Supabase Admin
    // API for app_metadata, which can't participate in a Prisma transaction.
    const promotion = await authService.setUserRole(ownerId, "owner");
    if (!promotion.success) {
      // Restaurant already committed; role sync is now stale. Logged, not
      // rolled back — same partial-failure tolerance setUserRole itself
      // uses for its own app_metadata step.
      console.error(
        `[restaurant] createRestaurant: restaurant ${restaurant.id} created but role promotion to owner failed for user ${ownerId}`
      );
    }
  }

  return { success: true, data: restaurant };
}

export async function updateRestaurant(
  id: string,
  ownerId: string,
  data: UpdateRestaurantInput
): Promise<ServiceResult<Restaurant>> {
  const restaurant = await prisma.restaurant.findUnique({ where: { id } });
  if (!restaurant) {
    return {
      success: false,
      error: { code: ERROR_CODES.NOT_FOUND, message: MESSAGES.restaurant.notFound },
    };
  }

  if (restaurant.ownerId !== ownerId) {
    return {
      success: false,
      error: { code: ERROR_CODES.FORBIDDEN, message: MESSAGES.restaurant.forbidden },
    };
  }

  try {
    const updated = await prisma.restaurant.update({ where: { id }, data });
    return { success: true, data: updated };
  } catch (err) {
    console.error("[restaurant] updateRestaurant: update failed", err);
    return {
      success: false,
      error: { code: ERROR_CODES.RESTAURANT_UPDATE_FAILED, message: MESSAGES.restaurant.updateFailed },
    };
  }
}

export async function listPublicRestaurants(filter: ListPublicRestaurantsInput) {
  // status is always APPROVED here, hardcoded — never accept it from the caller.
  const where: Prisma.RestaurantWhereInput = {
    status: RestaurantStatus.APPROVED,
    ...(filter.category ? { category: filter.category } : {}),
    ...(filter.q?.trim() ? { name: { contains: filter.q.trim(), mode: "insensitive" } } : {}),
  };

  // openingHours included per restaurant so the card grid can show "open /
  // closed now" (isOpenNow in slot.engine.ts) without a round trip per
  // card — same reasoning as getRestaurantById including them for the
  // detail page's accordion.
  const [items, total, categoryRows] = await Promise.all([
    prisma.restaurant.findMany({
      where,
      include: { openingHours: { orderBy: { dayOfWeek: "asc" } } },
      orderBy: { createdAt: "desc" },
      skip: (filter.page - 1) * filter.pageSize,
      take: filter.pageSize,
    }),
    prisma.restaurant.count({ where }),
    // Always over *all* approved restaurants, not just this page/filter —
    // the category filter's own option list shouldn't shrink to only what
    // the current filter already matches.
    prisma.restaurant.findMany({
      where: { status: RestaurantStatus.APPROVED },
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    }),
  ]);

  return {
    items,
    total,
    page: filter.page,
    pageSize: filter.pageSize,
    categories: categoryRows.map((row) => row.category),
  };
}

// For /owner/status and /owner/settings — an owner can have more than one
// restaurant (Task 7's multi-restaurant selector), so both pages need to
// list all of this owner's restaurants (any status, not just APPROVED)
// before picking which one to show/edit.
export async function listRestaurantsByOwner(ownerId: string): Promise<Restaurant[]> {
  return prisma.restaurant.findMany({
    where: { ownerId },
    orderBy: { createdAt: "desc" },
  });
}

export type RestaurantWithOpeningHours = Restaurant & {
  openingHours: { dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean }[];
};

// Wrapped in React's cache() so /restaurants/[id]'s generateMetadata and its
// page component — two separate function calls Next.js makes for the same
// request — share one query instead of two, as long as both call this with
// the same (id, viewer) pair. viewer must come from getProfileOrNull()
// (also cache()-wrapped in lib/dal.ts), not re-derived some other way, or
// the two calls get different object references and the dedupe misses.
export const getRestaurantById = cache(async function getRestaurantById(
  id: string,
  viewer: Profile | null
): Promise<RestaurantWithOpeningHours | null> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id },
    include: { openingHours: { orderBy: { dayOfWeek: "asc" } } },
  });
  if (!restaurant) {
    return null;
  }

  if (restaurant.status === RestaurantStatus.APPROVED) {
    return restaurant;
  }
  if (viewer?.role === "admin") {
    return restaurant;
  }
  if (viewer && restaurant.ownerId === viewer.id) {
    return restaurant;
  }

  // Not visible to this viewer — treated the same as not existing, so a
  // pending/rejected restaurant's existence isn't leaked to strangers.
  return null;
});

// /owner/settings needs bookingSetting too (for the booking-rules form),
// which getRestaurantById above deliberately doesn't include — that
// function backs the public restaurant detail page, and every extra
// relation on it is extra weight on every public page view. Ownership is
// checked here directly (not "APPROVED-or-admin-or-owner" visibility —
// this is edit access, only the owner or an admin should ever get a row
// back), same relationship-based pattern as updateRestaurant.
export async function getRestaurantForOwner(
  id: string,
  viewer: Profile
): Promise<
  | (RestaurantWithOpeningHours & {
      bookingSetting: BookingSetting | null;
      owner: { id: string; email: string | null; fullName: string | null };
    })
  | null
> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id },
    include: {
      openingHours: { orderBy: { dayOfWeek: "asc" } },
      bookingSetting: true,
      // Only /admin/restaurants/[id] (Task 8) reads this field —
      // /owner/settings (the other caller) already knows who the viewer is,
      // it just doesn't use it. Harmless extra data on that path, and
      // avoids a second query/service function for the admin page.
      owner: { select: { id: true, email: true, fullName: true } },
    },
  });
  if (!restaurant) {
    return null;
  }
  if (viewer.role !== "admin" && restaurant.ownerId !== viewer.id) {
    return null;
  }
  return restaurant;
}

// Whether `slotTime` (an existing booking's stored "HH:MM") still falls
// inside a *prospective* opening window. Deliberately a smaller check than
// slot.engine.ts's resolveOpeningWindow/resolveSlotStartMinutes — this only
// needs "is this stored time still inside the window at all", not the full
// slot-grid alignment slot.engine.ts computes (which also needs
// slotDuration, not available here). Same crosses-midnight handling
// (closeTime < openTime wraps past 1439) so a restaurant open past midnight
// isn't flagged as conflicting with its own overnight bookings.
function isSlotWithinOpeningWindow(slotTime: string, openTime: string, closeTime: string): boolean {
  const slotMinutes = timeStringToMinutes(slotTime);
  const openMinutes = timeStringToMinutes(openTime);
  let closeMinutes = timeStringToMinutes(closeTime);
  const crossesMidnight = closeMinutes < openMinutes;
  if (crossesMidnight) {
    closeMinutes += 24 * 60;
  }
  const adjustedSlotMinutes = crossesMidnight && slotMinutes < openMinutes ? slotMinutes + 24 * 60 : slotMinutes;
  return adjustedSlotMinutes >= openMinutes && adjustedSlotMinutes < closeMinutes;
}

type FutureBookingRow = { id: string; bookingDate: Date; slotTime: string; partySize: number };

// "Future" = today (Bangkok) or later, and still holding a seat
// (SEAT_CONSUMING_STATUSES — same definition loadSlotContext/createBooking
// use for occupancy). A resolved booking (completed/no-show/cancelled/
// rejected) never needs re-checking against new hours or capacity.
async function listFutureActiveBookings(restaurantId: string): Promise<FutureBookingRow[]> {
  return prisma.booking.findMany({
    where: {
      restaurantId,
      bookingDate: { gte: bangkokToday() },
      status: { in: SEAT_CONSUMING_STATUSES },
    },
    select: { id: true, bookingDate: true, slotTime: true, partySize: true },
  });
}

async function countBookingsConflictingWithHours(restaurantId: string, hours: OpeningHourInput[]): Promise<number> {
  const bookings = await listFutureActiveBookings(restaurantId);
  const hoursByDay = new Map(hours.map((h) => [h.dayOfWeek, h]));

  let count = 0;
  for (const booking of bookings) {
    const newHours = hoursByDay.get(calendarDayOfWeek(booking.bookingDate));
    if (!newHours || newHours.isClosed || !isSlotWithinOpeningWindow(booking.slotTime, newHours.openTime, newHours.closeTime)) {
      count++;
    }
  }
  return count;
}

async function countBookingsConflictingWithSettings(
  restaurantId: string,
  settings: { capacityPerSlot: number; maxPartySize: number }
): Promise<number> {
  const bookings = await listFutureActiveBookings(restaurantId);

  // Sum party size per (date, slotTime) first — a single over-capacity slot
  // shouldn't need its own query; this is already every future active
  // booking for the restaurant, grouped in memory.
  const slotTotals = new Map<string, number>();
  for (const booking of bookings) {
    const key = `${formatCalendarDateString(booking.bookingDate)}|${booking.slotTime}`;
    slotTotals.set(key, (slotTotals.get(key) ?? 0) + booking.partySize);
  }

  let count = 0;
  for (const booking of bookings) {
    const key = `${formatCalendarDateString(booking.bookingDate)}|${booking.slotTime}`;
    const slotTotal = slotTotals.get(key)!;
    if (slotTotal > settings.capacityPerSlot || booking.partySize > settings.maxPartySize) {
      count++;
    }
  }
  return count;
}

/**
 * Always replaces all 7 rows in one call, never a partial update — see
 * updateOpeningHoursSchema's comment for why. When `confirm` is false and
 * the new hours would put any future active booking outside the opening
 * window (or on a day newly marked closed), nothing is written and a
 * CONFIRMATION_REQUIRED error is returned instead, carrying how many
 * bookings would be affected — the caller must resend with `confirm: true`
 * to actually save. Existing bookings are never auto-cancelled either way
 * (see CLAUDE.md's architecture-decisions section).
 */
export async function updateOpeningHours(
  restaurantId: string,
  ownerId: string,
  hours: OpeningHourInput[],
  confirm: boolean
): Promise<ServiceResult<OpeningHour[]>> {
  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
  if (!restaurant) {
    return { success: false, error: { code: ERROR_CODES.NOT_FOUND, message: MESSAGES.restaurant.notFound } };
  }
  if (restaurant.ownerId !== ownerId) {
    return { success: false, error: { code: ERROR_CODES.FORBIDDEN, message: MESSAGES.restaurant.forbidden } };
  }

  if (!confirm) {
    const affected = await countBookingsConflictingWithHours(restaurantId, hours);
    if (affected > 0) {
      return {
        success: false,
        error: { code: ERROR_CODES.CONFIRMATION_REQUIRED, message: MESSAGES.owner.hoursConflictWarning(affected) },
      };
    }
  }

  try {
    const updated = await prisma.$transaction(
      hours.map((h) =>
        prisma.openingHour.update({
          where: { restaurantId_dayOfWeek: { restaurantId, dayOfWeek: h.dayOfWeek } },
          data: { openTime: h.openTime, closeTime: h.closeTime, isClosed: h.isClosed },
        })
      )
    );
    return { success: true, data: updated };
  } catch (err) {
    console.error("[restaurant] updateOpeningHours: transaction failed", err);
    return {
      success: false,
      error: { code: ERROR_CODES.RESTAURANT_UPDATE_FAILED, message: MESSAGES.restaurant.updateFailed },
    };
  }
}

/**
 * Same confirm-then-save shape as updateOpeningHours: with `confirm` false,
 * checks whether any future active booking would end up over the new
 * capacityPerSlot (summed per slot) or over the new maxPartySize
 * individually, and if so returns CONFIRMATION_REQUIRED instead of saving.
 */
export async function updateBookingSetting(
  restaurantId: string,
  ownerId: string,
  input: Omit<UpdateBookingSettingInput, "confirm">,
  confirm: boolean
): Promise<ServiceResult<BookingSetting>> {
  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
  if (!restaurant) {
    return { success: false, error: { code: ERROR_CODES.NOT_FOUND, message: MESSAGES.restaurant.notFound } };
  }
  if (restaurant.ownerId !== ownerId) {
    return { success: false, error: { code: ERROR_CODES.FORBIDDEN, message: MESSAGES.restaurant.forbidden } };
  }

  if (!confirm) {
    const affected = await countBookingsConflictingWithSettings(restaurantId, input);
    if (affected > 0) {
      return {
        success: false,
        error: { code: ERROR_CODES.CONFIRMATION_REQUIRED, message: MESSAGES.owner.settingsConflictWarning(affected) },
      };
    }
  }

  try {
    const updated = await prisma.bookingSetting.update({ where: { restaurantId }, data: input });
    return { success: true, data: updated };
  } catch (err) {
    console.error("[restaurant] updateBookingSetting: update failed", err);
    return {
      success: false,
      error: { code: ERROR_CODES.RESTAURANT_UPDATE_FAILED, message: MESSAGES.restaurant.updateFailed },
    };
  }
}

/**
 * Owner-driven counterpart to admin.service.ts's reviewRestaurant: moves a
 * REJECTED restaurant back to PENDING for a fresh review. Only legal from
 * REJECTED (reuses ALLOWED_TRANSITIONS so this can't drift from what an
 * admin is separately allowed to do to the same row — see that file's
 * comment). rejectReason is deliberately left untouched, same rule as
 * Restaurant.rejectReason elsewhere: it's history, not cleared by the next
 * transition, so an admin reviewing again can see what was flagged before.
 * A separate action from PATCH updateRestaurant on purpose (not an
 * automatic side effect of editing) — see CLAUDE.md's architecture
 * decisions for why: an automatic status flip on every edit would resubmit
 * a restaurant before the owner necessarily meant to.
 */
export async function resubmitRestaurant(id: string, ownerId: string): Promise<ServiceResult<Restaurant>> {
  const restaurant = await prisma.restaurant.findUnique({ where: { id } });
  if (!restaurant) {
    return { success: false, error: { code: ERROR_CODES.NOT_FOUND, message: MESSAGES.restaurant.notFound } };
  }
  if (restaurant.ownerId !== ownerId) {
    return { success: false, error: { code: ERROR_CODES.FORBIDDEN, message: MESSAGES.restaurant.forbidden } };
  }

  if (!ALLOWED_TRANSITIONS[restaurant.status].includes(RestaurantStatus.PENDING)) {
    return {
      success: false,
      error: { code: ERROR_CODES.INVALID_STATE, message: MESSAGES.owner.resubmitOnlyFromRejected },
    };
  }

  try {
    const updated = await prisma.restaurant.update({
      where: { id },
      data: { status: RestaurantStatus.PENDING, reviewedAt: null, reviewedById: null },
    });
    return { success: true, data: updated };
  } catch (err) {
    console.error("[restaurant] resubmitRestaurant: update failed", err);
    return {
      success: false,
      error: { code: ERROR_CODES.RESTAURANT_UPDATE_FAILED, message: MESSAGES.restaurant.updateFailed },
    };
  }
}
