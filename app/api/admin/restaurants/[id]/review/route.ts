import type { NextRequest } from "next/server";
import { requireRoleOrThrow, ForbiddenError, UnauthorizedError } from "@/lib/dal";
import { ok, fail, statusForCode, ERROR_CODES } from "@/lib/api-response";
import { MESSAGES } from "@/constants/messages";
import { reviewRestaurantSchema } from "@/modules/admin/admin.schema";
import * as adminService from "@/modules/admin/admin.service";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const admin = await requireRoleOrThrow("admin");

    const parsed = reviewRestaurantSchema.safeParse(await request.json());
    if (!parsed.success) {
      return fail(ERROR_CODES.VALIDATION_ERROR, parsed.error.issues[0]?.message ?? MESSAGES.admin.reviewFailed, 400);
    }

    const result = await adminService.reviewRestaurant(id, admin.id, parsed.data.action, parsed.data.reason);
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
