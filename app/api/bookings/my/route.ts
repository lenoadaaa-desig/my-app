import type { NextRequest } from "next/server";
import { requireProfileOrThrow, ForbiddenError, UnauthorizedError } from "@/lib/dal";
import { ok, fail, ERROR_CODES } from "@/lib/api-response";
import { MESSAGES } from "@/constants/messages";
import * as bookingService from "@/modules/booking/booking.service";

// Any logged-in profile — see app/api/bookings/route.ts's POST for why
// this isn't requireRoleOrThrow("customer"): an owner can still have
// bookings of their own as a diner, and needs to see them here too.
export async function GET(request: NextRequest) {
  try {
    const profile = await requireProfileOrThrow();

    const page = Number(request.nextUrl.searchParams.get("page") ?? "1");
    const pageSize = Number(request.nextUrl.searchParams.get("pageSize") ?? "20");

    const result = await bookingService.getMyBookings(profile.id, {
      page: Number.isInteger(page) && page > 0 ? page : 1,
      pageSize: Number.isInteger(pageSize) && pageSize > 0 && pageSize <= 50 ? pageSize : 20,
    });

    return ok(result);
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
