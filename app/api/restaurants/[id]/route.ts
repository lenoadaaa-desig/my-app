import type { NextRequest } from "next/server";
import { requireRoleOrThrow, getProfileOrNull, ForbiddenError, UnauthorizedError } from "@/lib/dal";
import { ok, fail, statusForCode, ERROR_CODES } from "@/lib/api-response";
import { MESSAGES } from "@/constants/messages";
import { updateRestaurantSchema } from "@/modules/restaurant/restaurant.schema";
import * as restaurantService from "@/modules/restaurant/restaurant.service";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const profile = await requireRoleOrThrow("owner");

    const parsed = updateRestaurantSchema.safeParse(await request.json());
    if (!parsed.success) {
      return fail(ERROR_CODES.VALIDATION_ERROR, parsed.error.issues[0]?.message ?? MESSAGES.restaurant.updateFailed, 400);
    }

    const result = await restaurantService.updateRestaurant(id, profile.id, parsed.data);
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

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getProfileOrNull();

  const restaurant = await restaurantService.getRestaurantById(id, viewer);
  if (!restaurant) {
    return fail(ERROR_CODES.NOT_FOUND, MESSAGES.restaurant.notFound, 404);
  }

  return ok(restaurant);
}
