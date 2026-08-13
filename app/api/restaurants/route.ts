import type { NextRequest } from "next/server";
import { requireProfileOrThrow, ForbiddenError, UnauthorizedError } from "@/lib/dal";
import { ok, fail, statusForCode, ERROR_CODES } from "@/lib/api-response";
import { MESSAGES } from "@/constants/messages";
import { createRestaurantSchema, listPublicRestaurantsSchema } from "@/modules/restaurant/restaurant.schema";
import * as restaurantService from "@/modules/restaurant/restaurant.service";

export async function POST(request: NextRequest) {
  try {
    const profile = await requireProfileOrThrow();

    const parsed = createRestaurantSchema.safeParse(await request.json());
    if (!parsed.success) {
      return fail(ERROR_CODES.VALIDATION_ERROR, parsed.error.issues[0]?.message ?? MESSAGES.restaurant.createFailed, 400);
    }

    const result = await restaurantService.createRestaurant(profile.id, parsed.data);
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

export async function GET(request: NextRequest) {
  const parsed = listPublicRestaurantsSchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams)
  );
  if (!parsed.success) {
    return fail(ERROR_CODES.VALIDATION_ERROR, MESSAGES.restaurant.invalidQuery, 400);
  }

  const result = await restaurantService.listPublicRestaurants(parsed.data);
  return ok(result);
}
