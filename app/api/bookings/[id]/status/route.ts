import type { NextRequest } from "next/server";
import { requireRoleOrThrow, ForbiddenError, UnauthorizedError } from "@/lib/dal";
import { ok, fail, statusForCode, ERROR_CODES } from "@/lib/api-response";
import { MESSAGES } from "@/constants/messages";
import { changeBookingStatusSchema } from "@/modules/booking/booking.schema";
import * as bookingService from "@/modules/booking/booking.service";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const profile = await requireRoleOrThrow("owner", "admin");

    const parsed = changeBookingStatusSchema.safeParse(await request.json());
    if (!parsed.success) {
      return fail(ERROR_CODES.VALIDATION_ERROR, parsed.error.issues[0]?.message ?? MESSAGES.booking.statusInvalid, 400);
    }

    const result = await bookingService.changeBookingStatus(id, profile, parsed.data.status, parsed.data.reason);
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
