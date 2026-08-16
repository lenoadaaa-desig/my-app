import type { NextRequest } from "next/server";
import { requireRoleOrThrow, ForbiddenError, UnauthorizedError } from "@/lib/dal";
import { ok, fail, statusForCode, ERROR_CODES } from "@/lib/api-response";
import { MESSAGES } from "@/constants/messages";
import * as restaurantService from "@/modules/restaurant/restaurant.service";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const profile = await requireRoleOrThrow("owner");

    const result = await restaurantService.resubmitRestaurant(id, profile.id);
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
