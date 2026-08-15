import "server-only";

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
