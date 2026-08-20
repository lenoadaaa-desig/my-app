import "server-only";

import { RestaurantStatus, type Restaurant } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ERROR_CODES, type ErrorCode } from "@/lib/api-response";
import { MESSAGES, RESTAURANT_STATUS_LABELS_TH } from "@/constants/messages";
import type { ReviewRestaurantInput } from "./admin.schema";

type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: ErrorCode; message: string } };

export type ReviewAction = ReviewRestaurantInput["action"];

// Explicit state machine, not nested ifs — booking status will need the same
// shape (Task 5), so this is the pattern to reuse.
//
// Exported (Task 7 phase 1 round 2): REJECTED -> PENDING is never reached
// through admin review itself (ACTION_TARGET_STATUS below only ever targets
// APPROVED/REJECTED/SUSPENDED) — it exists for the owner-driven resubmit
// flow (modules/restaurant/restaurant.service.ts's resubmitRestaurant),
// which reuses this exact graph rather than declaring its own, so a
// REJECTED restaurant's two ways forward (an admin approving it directly,
// or its owner resubmitting for a fresh review) can never disagree about
// what's legal from that state.
export const ALLOWED_TRANSITIONS: Record<RestaurantStatus, RestaurantStatus[]> = {
  [RestaurantStatus.PENDING]: [RestaurantStatus.APPROVED, RestaurantStatus.REJECTED],
  [RestaurantStatus.APPROVED]: [RestaurantStatus.SUSPENDED],
  [RestaurantStatus.REJECTED]: [RestaurantStatus.APPROVED, RestaurantStatus.PENDING],
  [RestaurantStatus.SUSPENDED]: [RestaurantStatus.APPROVED],
};

const ACTION_TARGET_STATUS: Record<ReviewAction, RestaurantStatus> = {
  approve: RestaurantStatus.APPROVED,
  reject: RestaurantStatus.REJECTED,
  suspend: RestaurantStatus.SUSPENDED,
};

export type RestaurantWithOwner = Restaurant & {
  owner: { id: string; email: string | null; fullName: string | null };
};

// Sort direction depends on the status being queried: PENDING is a queue
// (oldest submission first is what an admin should clear first); every
// other status is a completed decision, where "most recently decided" is
// the useful order. reviewedAt is null for every PENDING row and, in the
// ordinary app flow, only for PENDING rows — every other status is reached
// exclusively through reviewRestaurant(), which always sets it. Fixture
// data can violate that (npm run db:seed inserts rows as APPROVED directly,
// bypassing reviewRestaurant() and its reviewedAt write), so `nulls: "last"`
// is explicit rather than relying on Postgres's default NULLS FIRST for
// DESC — confirmed by querying against the seeded data, whose 3 null-
// reviewedAt rows sorted before real reviewed ones without this.
export async function listRestaurantsByStatus(status: RestaurantStatus): Promise<RestaurantWithOwner[]> {
  return prisma.restaurant.findMany({
    where: { status },
    orderBy:
      status === RestaurantStatus.PENDING
        ? { createdAt: "asc" }
        : { reviewedAt: { sort: "desc", nulls: "last" } },
    include: { owner: { select: { id: true, email: true, fullName: true } } },
  });
}

const ALL_ACTIONS = Object.keys(ACTION_TARGET_STATUS) as ReviewAction[];

// Derives which review actions are legal from a given status by reusing
// ALLOWED_TRANSITIONS/ACTION_TARGET_STATUS above — never a second hardcoded
// state table. Used to compute the admin detail page's visible buttons
// server-side (this whole module is "server-only", so a client component
// can't import ALLOWED_TRANSITIONS directly).
export function getAllowedActions(status: RestaurantStatus): ReviewAction[] {
  const allowedStatuses = ALLOWED_TRANSITIONS[status];
  return ALL_ACTIONS.filter((action) => allowedStatuses.includes(ACTION_TARGET_STATUS[action]));
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
