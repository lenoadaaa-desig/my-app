import { z } from "zod";
import { MESSAGES } from "@/constants/messages";

// No status/rejectReason/reviewedAt/reviewedById field on either schema —
// zod strips unknown keys by default, so a client sending them has no
// effect (same pattern as signUpSchema omitting role).
export const createRestaurantSchema = z.object({
  name: z.string().min(1, MESSAGES.restaurant.nameRequired),
  description: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().min(1).optional(),
  category: z.string().min(1, MESSAGES.restaurant.categoryRequired),
  coverImage: z.string().optional(),
});

export type CreateRestaurantInput = z.infer<typeof createRestaurantSchema>;

export const updateRestaurantSchema = createRestaurantSchema.partial();

export type UpdateRestaurantInput = z.infer<typeof updateRestaurantSchema>;

// Query-param validation errors here are surfaced with a fixed generic
// message by the route (not these per-field ones) since a malformed
// ?page=abc fails zod's base type coercion before any custom message here
// would apply.
export const listPublicRestaurantsSchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export type ListPublicRestaurantsInput = z.infer<typeof listPublicRestaurantsSchema>;

const TIME_STRING_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export const openingHourInputSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    openTime: z.string().regex(TIME_STRING_REGEX, MESSAGES.owner.hoursTimeFormatInvalid),
    closeTime: z.string().regex(TIME_STRING_REGEX, MESSAGES.owner.hoursTimeFormatInvalid),
    isClosed: z.boolean(),
  })
  // Only meaningful for an open day — a closed day's openTime/closeTime are
  // unused placeholders, so a client that leaves them equal there (e.g. both
  // still "10:00") shouldn't be rejected for it.
  .refine((data) => data.isClosed || data.openTime !== data.closeTime, {
    message: MESSAGES.owner.hoursZeroLengthInvalid,
    path: ["closeTime"],
  });

export type OpeningHourInput = z.infer<typeof openingHourInputSchema>;

// Always all 7 rows, one per dayOfWeek, never a partial update — see
// updateOpeningHours in restaurant.service.ts for why (a missing day would
// silently make the slot engine treat that day as closed... or worse, as
// whatever stale row Prisma left behind). z.array(...).length(7) plus a
// dayOfWeek-uniqueness check together force the 7 rows to be exactly
// {0,1,2,3,4,5,6} once each, since every individual dayOfWeek is already
// constrained to 0-6 above.
export const updateOpeningHoursSchema = z
  .object({
    hours: z.array(openingHourInputSchema).length(7, MESSAGES.owner.hoursCountInvalid),
    confirm: z.boolean().optional().default(false),
  })
  .refine((data) => new Set(data.hours.map((h) => h.dayOfWeek)).size === 7, {
    message: MESSAGES.owner.hoursDaysInvalid,
    path: ["hours"],
  });

export type UpdateOpeningHoursInput = z.infer<typeof updateOpeningHoursSchema>;

export const updateBookingSettingSchema = z
  .object({
    slotDuration: z.number(MESSAGES.owner.slotDurationInvalid).int().positive(MESSAGES.owner.slotDurationInvalid),
    capacityPerSlot: z
      .number(MESSAGES.owner.capacityPerSlotInvalid)
      .int()
      .positive(MESSAGES.owner.capacityPerSlotInvalid),
    maxPartySize: z.number(MESSAGES.owner.maxPartySizeInvalid).int().positive(MESSAGES.owner.maxPartySizeInvalid),
    advanceDays: z.number(MESSAGES.owner.advanceDaysInvalid).int().min(1, MESSAGES.owner.advanceDaysInvalid),
    minLeadHours: z.number(MESSAGES.owner.minLeadHoursInvalid).int().min(0, MESSAGES.owner.minLeadHoursInvalid),
    autoConfirm: z.boolean(),
    confirm: z.boolean().optional().default(false),
  })
  .refine((data) => data.maxPartySize <= data.capacityPerSlot, {
    message: MESSAGES.owner.maxPartySizeExceedsCapacity,
    path: ["maxPartySize"],
  });

export type UpdateBookingSettingInput = z.infer<typeof updateBookingSettingSchema>;
