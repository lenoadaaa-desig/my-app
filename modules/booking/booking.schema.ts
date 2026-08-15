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
