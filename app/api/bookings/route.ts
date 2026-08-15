import type { NextRequest } from "next/server";
import { requireProfileOrThrow, ForbiddenError, UnauthorizedError } from "@/lib/dal";
import { ok, fail, statusForCode, ERROR_CODES } from "@/lib/api-response";
import { MESSAGES } from "@/constants/messages";
import { createBookingSchema } from "@/modules/booking/booking.schema";
import * as bookingService from "@/modules/booking/booking.service";

// Any logged-in profile, not requireRoleOrThrow("customer") — role here is
// the *highest* privilege a profile holds, not an exclusive account type.
// An owner (promoted permanently on creating their first restaurant, Task
// 3, with no way back to "customer") still needs to book as a diner at
// other restaurants, or even their own.
export async function POST(request: NextRequest) {
  try {
    const profile = await requireProfileOrThrow();

    const parsed = createBookingSchema.safeParse(await request.json());
    if (!parsed.success) {
      return fail(ERROR_CODES.VALIDATION_ERROR, parsed.error.issues[0]?.message ?? MESSAGES.booking.createFailed, 400);
    }

    const result = await bookingService.createBooking(profile.id, parsed.data);
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
