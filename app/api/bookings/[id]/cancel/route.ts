import type { NextRequest } from "next/server";
import { BookingStatus } from "@prisma/client";
import { requireProfileOrThrow, ForbiddenError, UnauthorizedError } from "@/lib/dal";
import { ok, fail, statusForCode, ERROR_CODES } from "@/lib/api-response";
import { MESSAGES } from "@/constants/messages";
import * as bookingService from "@/modules/booking/booking.service";

// Any logged-in profile, not requireRoleOrThrow("customer") — see
// app/api/bookings/route.ts's POST. changeBookingStatus itself decides
// whether this actor may cancel *this* booking based on whether they're
// its customer, not their role.
export async function PATCH(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const profile = await requireProfileOrThrow();

    const result = await bookingService.changeBookingStatus(id, profile, BookingStatus.CANCELLED);
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
