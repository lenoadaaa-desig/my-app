import type { NextRequest } from "next/server";
import { requireRoleOrThrow, ForbiddenError, UnauthorizedError } from "@/lib/dal";
import { ok, fail, statusForCode, ERROR_CODES } from "@/lib/api-response";
import { MESSAGES } from "@/constants/messages";
import { listRestaurantBookingsQuerySchema } from "@/modules/booking/booking.schema";
import * as bookingService from "@/modules/booking/booking.service";

// restaurantId is required here even though the task's route sketch only
// wrote "?date=" — getRestaurantBookings needs to know which restaurant,
// and Restaurant.ownerId isn't unique (an owner can own more than one), so
// there's no other way to resolve it at this path (no /owner/restaurants/[id]/bookings
// nesting was asked for either). Flagged in the phase report.
export async function GET(request: NextRequest) {
  try {
    const profile = await requireRoleOrThrow("owner");

    const parsed = listRestaurantBookingsQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!parsed.success) {
      return fail(
        ERROR_CODES.VALIDATION_ERROR,
        parsed.error.issues[0]?.message ?? MESSAGES.booking.restaurantIdRequired,
        400
      );
    }

    const result = await bookingService.getRestaurantBookings(parsed.data.restaurantId, profile.id, parsed.data.date);
    if (!result.success) {
      return fail(result.error.code, result.error.message, statusForCode(result.error.code));
    }

    return ok(result.data);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return fail(ERROR_CODES.UNAUTHORIZED, MESSAGES.auth.unauthorized, 401);
    }
    if (err instanceof ForbiddenError) {
      return fail(ERROR_CODES.FORBIDDEN, MESSAGES.auth.forbidden, 403);
    }
    throw err;
  }
}
