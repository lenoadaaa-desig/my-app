import type { NextRequest } from "next/server";
import type { RestaurantStatus } from "@prisma/client";
import { requireRoleOrThrow, ForbiddenError, UnauthorizedError } from "@/lib/dal";
import { ok, fail, ERROR_CODES } from "@/lib/api-response";
import { MESSAGES } from "@/constants/messages";
import { listRestaurantsQuerySchema } from "@/modules/admin/admin.schema";
import * as adminService from "@/modules/admin/admin.service";

export async function GET(request: NextRequest) {
  try {
    await requireRoleOrThrow("admin");

    const parsed = listRestaurantsQuerySchema.safeParse({
      status: request.nextUrl.searchParams.get("status") ?? undefined,
    });
    if (!parsed.success) {
      return fail(ERROR_CODES.VALIDATION_ERROR, MESSAGES.restaurant.invalidQuery, 400);
    }

    const status = parsed.data.status.toUpperCase() as RestaurantStatus;
    const restaurants = await adminService.listRestaurantsByStatus(status);
    return ok(restaurants);
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
