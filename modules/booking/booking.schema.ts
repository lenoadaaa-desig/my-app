import { z } from "zod";
import { MESSAGES } from "@/constants/messages";

// Shape-only check here (required, "YYYY-MM-DD"). Real calendar validity
// (rejecting e.g. "2026-13-45") is checked once, authoritatively, by
// parseCalendarDateString in lib/datetime.ts — called from the service, not
// duplicated here.
export const getAvailableSlotsQuerySchema = z.object({
  date: z
    .string(MESSAGES.booking.dateRequired)
    .regex(/^\d{4}-\d{2}-\d{2}$/, MESSAGES.booking.invalidDateFormat),
});

export type GetAvailableSlotsQuery = z.infer<typeof getAvailableSlotsQuerySchema>;

const DATE_STRING_SCHEMA = z
  .string(MESSAGES.booking.dateRequired)
  .regex(/^\d{4}-\d{2}-\d{2}$/, MESSAGES.booking.invalidDateFormat);

// Shape-only here too — createBooking re-validates the date is a real
// calendar date, that slotTime matches a slot generateSlots actually
// produced, and that partySize fits maxPartySize (which is per-restaurant,
// unknowable at this layer).
export const createBookingSchema = z.object({
  restaurantId: z.uuid(MESSAGES.booking.restaurantIdRequired),
  date: DATE_STRING_SCHEMA,
  slotTime: z
    .string(MESSAGES.booking.slotTimeRequired)
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, MESSAGES.booking.invalidSlotTimeFormat),
  partySize: z.number(MESSAGES.booking.partySizeInvalid).int().positive(MESSAGES.booking.partySizeInvalid),
  customerNote: z.string().max(500).optional(),
});

export type CreateBookingSchemaInput = z.infer<typeof createBookingSchema>;

// PENDING excluded: no entry in ALLOWED_BOOKING_TRANSITIONS ever targets it
// (bookings only ever start there), so it's never a legal PATCH value from
// any current status — reject it here instead of round-tripping to the
// service for an INVALID_STATE it would produce every time anyway.
export const changeBookingStatusSchema = z.object({
  status: z.enum(["CONFIRMED", "REJECTED", "CANCELLED", "CHECKED_IN", "COMPLETED", "NO_SHOW"], MESSAGES.booking.statusInvalid),
  reason: z.string().optional(),
});

export type ChangeBookingStatusInput = z.infer<typeof changeBookingStatusSchema>;

export const listRestaurantBookingsQuerySchema = z.object({
  restaurantId: z.uuid(MESSAGES.booking.restaurantIdRequired),
  date: DATE_STRING_SCHEMA.optional(),
});

export type ListRestaurantBookingsQuery = z.infer<typeof listRestaurantBookingsQuerySchema>;
