import { requireRoleOrThrow, ForbiddenError, UnauthorizedError } from "@/lib/dal";
import { ok, fail, ERROR_CODES } from "@/lib/api-response";
import { MESSAGES } from "@/constants/messages";
import * as adminService from "@/modules/admin/admin.service";

export async function GET() {
  try {
    await requireRoleOrThrow("admin");

    const restaurants = await adminService.listPendingRestaurants();
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
