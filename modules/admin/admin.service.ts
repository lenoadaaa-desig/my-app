import "server-only";

import { RestaurantStatus, type Restaurant } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ERROR_CODES, type ErrorCode } from "@/lib/api-response";
import { MESSAGES, RESTAURANT_STATUS_LABELS_TH } from "@/constants/messages";
import type { ReviewRestaurantInput } from "./admin.schema";

type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: ErrorCode; message: string } };

type ReviewAction = ReviewRestaurantInput["action"];

// Explicit state machine, not nested ifs — booking status will need the same
// shape (Task 5), so this is the pattern to reuse.
const ALLOWED_TRANSITIONS: Record<RestaurantStatus, RestaurantStatus[]> = {
  [RestaurantStatus.PENDING]: [RestaurantStatus.APPROVED, RestaurantStatus.REJECTED],
  [RestaurantStatus.APPROVED]: [RestaurantStatus.SUSPENDED],
  [RestaurantStatus.REJECTED]: [RestaurantStatus.APPROVED],
  [RestaurantStatus.SUSPENDED]: [RestaurantStatus.APPROVED],
};

const ACTION_TARGET_STATUS: Record<ReviewAction, RestaurantStatus> = {
  approve: RestaurantStatus.APPROVED,
  reject: RestaurantStatus.REJECTED,
  suspend: RestaurantStatus.SUSPENDED,
};

export async function listPendingRestaurants(): Promise<Restaurant[]> {
  return prisma.restaurant.findMany({
    where: { status: RestaurantStatus.PENDING },
    orderBy: { createdAt: "asc" }, // longest-waiting first
  });
}

export async function reviewRestaurant(
  id: string,
  adminId: string,
  action: ReviewAction,
  reason?: string
): Promise<ServiceResult<Restaurant>> {
  const restaurant = await prisma.restaurant.findUnique({ where: { id } });
  if (!restaurant) {
    return {
      success: false,
      error: { code: ERROR_CODES.NOT_FOUND, message: MESSAGES.admin.restaurantNotFound },
    };
  }

  // Re-checked here (not just in the zod schema) so a caller that skips
  // validation still can't reject without a reason.
  if (action === "reject" && !reason?.trim()) {
    return {
      success: false,
      error: { code: ERROR_CODES.VALIDATION_ERROR, message: MESSAGES.admin.reviewReasonRequired },
    };
  }

  const targetStatus = ACTION_TARGET_STATUS[action];
  const allowedFromCurrent = ALLOWED_TRANSITIONS[restaurant.status];
  if (!allowedFromCurrent.includes(targetStatus)) {
    return {
      success: false,
      error: {
        code: ERROR_CODES.INVALID_STATE,
        message: MESSAGES.admin.invalidTransition(
          RESTAURANT_STATUS_LABELS_TH[restaurant.status],
          allowedFromCurrent.map((status) => RESTAURANT_STATUS_LABELS_TH[status])
        ),
      },
    };
  }

  try {
    const updated = await prisma.restaurant.update({
      where: { id },
      data: {
        status: targetStatus,
        // Only reject/suspend write a reason, and only when one is given —
        // approve never touches it, so a past rejection's reason survives
        // as history instead of being wiped on the next approval.
        ...(action !== "approve" && reason?.trim() ? { rejectReason: reason.trim() } : {}),
        reviewedAt: new Date(),
        reviewedById: adminId,
      },
    });
    return { success: true, data: updated };
  } catch (err) {
    console.error("[admin] reviewRestaurant: update failed", err);
    return {
      success: false,
      error: { code: ERROR_CODES.REVIEW_FAILED, message: MESSAGES.admin.reviewFailed },
    };
  }
}
