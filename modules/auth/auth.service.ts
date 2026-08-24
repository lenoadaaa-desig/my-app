import "server-only";

import type { User } from "@supabase/supabase-js";
import { Prisma, Role as PrismaRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ERROR_CODES, type ErrorCode } from "@/lib/api-response";
import { MESSAGES } from "@/constants/messages";
import type { Profile, Role } from "@/lib/dal";
import type { SignUpInput } from "./auth.schema";

type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: ErrorCode; message: string } };

function toPrismaRole(role: Role): PrismaRole {
  return role.toUpperCase() as PrismaRole;
}

function fromPrismaRole(role: PrismaRole): Role {
  return role.toLowerCase() as Role;
}

function toProfile(row: { id: string; email: string | null; role: PrismaRole }): Profile {
  return { id: row.id, email: row.email, role: fromPrismaRole(row.role) };
}

export type SignUpResult = {
  profile: Profile;
  // Whether supabase.auth.signUp() handed back a live session, i.e.
  // whether the Supabase project's "Confirm email" setting is currently on
  // or off — read from this call's actual result, never assumed from
  // config, so the caller works correctly either way without a code change
  // when that project setting changes. See CLAUDE.md's signup-flow note.
  hasSession: boolean;
};

export async function signUp(input: SignUpInput): Promise<ServiceResult<SignUpResult>> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
  });

  if (error || !data.user) {
    console.error("[auth] signUp: supabase.auth.signUp failed", error);
    return {
      success: false,
      error: { code: ERROR_CODES.SIGNUP_FAILED, message: MESSAGES.auth.signUpFailed },
    };
  }

  const hasSession = data.session !== null;
  const userId = data.user.id;
  const adminClient = createAdminClient();

  // Best-effort: undoes whichever of profile/auth-user got created before
  // the failure. deleteMany (not delete) so it's a safe no-op when the
  // profile was never created. If the auth-user delete below also fails,
  // ensureProfile() repairs the resulting orphan on next login.
  async function rollback() {
    await prisma.profile.deleteMany({ where: { id: userId } }).catch(() => {});
    await adminClient.auth.admin.deleteUser(userId).catch(() => {});
  }

  let profileRow;
  try {
    profileRow = await prisma.profile.create({
      data: {
        id: userId,
        email: input.email,
        fullName: input.name,
        phone: input.phone,
        role: PrismaRole.CUSTOMER,
      },
    });
  } catch (err) {
    console.error("[auth] signUp: profile creation failed, rolling back", err);
    await rollback();
    return {
      success: false,
      error: { code: ERROR_CODES.SIGNUP_FAILED, message: MESSAGES.auth.signUpFailed },
    };
  }

  const { error: metadataError } = await adminClient.auth.admin.updateUserById(userId, {
    app_metadata: { role: "customer" },
  });

  if (metadataError) {
    console.error("[auth] signUp: app_metadata update failed, rolling back", metadataError);
    await rollback();
    return {
      success: false,
      error: { code: ERROR_CODES.SIGNUP_FAILED, message: MESSAGES.auth.signUpFailed },
    };
  }

  return { success: true, data: { profile: toProfile(profileRow), hasSession } };
}

// Defensive repair for auth users that ended up with no profile row (e.g. a
// crash between auth.signUp succeeding and the profile insert running, which
// signUp's own rollback can't catch since the process didn't stay alive to
// run it). Always creates with role CUSTOMER — app_metadata is never trusted
// as a role source (Profile is the only source of truth, see CLAUDE.md rule
// 4), and never used to decide the repaired role.
export async function ensureProfile(user: User): Promise<void> {
  try {
    await prisma.profile.create({
      data: {
        id: user.id,
        email: user.email ?? null,
        role: PrismaRole.CUSTOMER,
      },
    });
    console.warn(
      `[auth] ensureProfile repaired an orphan auth user with no profile row (userId=${user.id}). ` +
        "This means a previous signUp's rollback was incomplete — investigate."
    );
  } catch (err) {
    // P2002 = unique constraint violation: a concurrent request already
    // created the row first. Not an orphan repair, just lost the race —
    // nothing to log, the other request's create() already logged (or
    // this profile was never missing in the first place).
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return;
    }
    throw err;
  }
}

// actingAdminId is optional and only supplied by the admin panel's own
// action (app/admin/actions.ts) — this function is also called from two
// system-internal auto-promotion paths that have no "acting admin" at all
// (lib/dal.ts's healOwnerRoleIfNeeded, restaurant.service.ts's
// createRestaurant, and scripts/seed-demo.ts), always promoting a
// customer/owner and never touching a row that's currently ADMIN. Leaving
// it undefined there is safe: the self-change check below can never match
// an undefined id, and the last-admin check only ever fires for a row
// that's already ADMIN, which none of those call sites ever target.
export async function setUserRole(
  userId: string,
  role: Role,
  actingAdminId?: string
): Promise<ServiceResult<Profile>> {
  // An admin changing their own role could lock themselves out of /admin
  // entirely with no other admin around to undo it — block unconditionally,
  // not just by disabling the dropdown in the UI (see admin-user-table.tsx).
  if (userId === actingAdminId) {
    return {
      success: false,
      error: { code: ERROR_CODES.INVALID_STATE, message: MESSAGES.auth.cannotChangeOwnRole },
    };
  }

  // Independent of the self-change check above: even when a *different*
  // admin is doing the demoting, the system must never end up with zero
  // admins. Only worth the extra query when actually demoting away from
  // admin — promotions and lateral customer/owner changes can't trigger this.
  if (role !== "admin") {
    const target = await prisma.profile.findUnique({ where: { id: userId }, select: { role: true } });
    if (target?.role === PrismaRole.ADMIN) {
      const adminCount = await prisma.profile.count({ where: { role: PrismaRole.ADMIN } });
      if (adminCount <= 1) {
        return {
          success: false,
          error: { code: ERROR_CODES.INVALID_STATE, message: MESSAGES.auth.cannotDemoteLastAdmin },
        };
      }
    }
  }

  let profileRow;
  try {
    profileRow = await prisma.profile.update({
      where: { id: userId },
      data: { role: toPrismaRole(role) },
    });
  } catch (err) {
    console.error("[auth] setUserRole: profile update failed", err);
    return {
      success: false,
      error: { code: ERROR_CODES.ROLE_UPDATE_FAILED, message: MESSAGES.auth.roleUpdateFailed },
    };
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient.auth.admin.updateUserById(userId, {
    app_metadata: { role },
  });

  if (error) {
    // Profile (source of truth) is already updated; app_metadata is now
    // stale until this is retried. Not a security issue — app_metadata is
    // never read for authorization — only a metadata drift to surface.
    console.error("[auth] setUserRole: app_metadata update failed", error);
    return {
      success: false,
      error: { code: ERROR_CODES.ROLE_UPDATE_FAILED, message: MESSAGES.auth.roleUpdateFailed },
    };
  }

  return { success: true, data: toProfile(profileRow) };
}

export async function deleteUser(userId: string, actingAdminId: string): Promise<ServiceResult<null>> {
  if (userId === actingAdminId) {
    return {
      success: false,
      error: { code: ERROR_CODES.INVALID_STATE, message: MESSAGES.auth.cannotDeleteSelf },
    };
  }

  // Profile.ownedRestaurants / .bookings use onDelete: Restrict — checked
  // up front (not just caught as a raw Prisma FK error after the fact) so
  // the admin sees exactly what's blocking the delete and how much of it
  // there is, instead of a generic failure message.
  const [restaurantCount, bookingCount] = await Promise.all([
    prisma.restaurant.count({ where: { ownerId: userId } }),
    prisma.booking.count({ where: { customerId: userId } }),
  ]);
  if (restaurantCount > 0 || bookingCount > 0) {
    return {
      success: false,
      error: {
        code: ERROR_CODES.INVALID_STATE,
        message: MESSAGES.auth.deleteUserBlocked(restaurantCount, bookingCount),
      },
    };
  }

  try {
    await prisma.profile.delete({ where: { id: userId } });
  } catch (err) {
    // Falls back to a generic message — this branch is now only reachable
    // by a genuine surprise (e.g. a row created between the counts above
    // and this delete), not the expected "user has dependents" case.
    console.error("[auth] deleteUser: profile delete failed", err);
    return {
      success: false,
      error: { code: ERROR_CODES.DELETE_USER_FAILED, message: MESSAGES.auth.deleteUserFailed },
    };
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient.auth.admin.deleteUser(userId);

  if (error) {
    console.error("[auth] deleteUser: auth user delete failed", error);
    return {
      success: false,
      error: { code: ERROR_CODES.DELETE_USER_FAILED, message: MESSAGES.auth.deleteUserFailed },
    };
  }

  return { success: true, data: null };
}
