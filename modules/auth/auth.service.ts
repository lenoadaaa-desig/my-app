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

export async function setUserRole(userId: string, role: Role): Promise<ServiceResult<Profile>> {
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

export async function deleteUser(userId: string): Promise<ServiceResult<null>> {
  try {
    // Profile.ownedRestaurants / .bookings use onDelete: Restrict, so this
    // throws (and we report failure) instead of deleting a user whose data
    // would be left dangling.
    await prisma.profile.delete({ where: { id: userId } });
  } catch (err) {
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
